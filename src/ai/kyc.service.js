/**
 * KYC AI Service
 *
 * Responsibilities:
 *  1. OCR  – read text from citizenship / license images using Tesseract.js
 *  2. Face  – compare selfie-with-ID against the citizenship photo using face-api.js
 *  3. Score – combine both results into a 0–100 trust score
 *
 * Trust score breakdown:
 *   OCR confidence   → up to 40 pts  (avg Tesseract confidence across docs)
 *   Face match       → up to 40 pts  (face-api.js euclidean distance → score)
 *   Data completeness→ up to 20 pts  (required fields present in user doc)
 *
 * face-api.js needs pre-trained model weights in  src/ai/models/
 * See  src/ai/models/README.md  for download instructions.
 * If the models folder is missing the library is skipped gracefully (face score = null).
 */

const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

// ─── Face-api lazy loader ─────────────────────────────────────────────────────

const MODELS_PATH = path.join(__dirname, 'models');

/** Loaded once, then cached. Returns null when face-api cannot be initialised. */
let _faceApiCache = null;
let _faceApiAttempted = false;

async function loadFaceApi() {
  if (_faceApiAttempted) return _faceApiCache;
  _faceApiAttempted = true;

  // Skip if models folder is absent – avoids crashing in dev without weights
  if (!fs.existsSync(MODELS_PATH)) {
    console.warn('[KYC] face-api models folder not found – face matching disabled');
    return null;
  }

  try {
    // @vladmandic/face-api's Node build requires @tensorflow/tfjs-node (native C++).
    // To avoid needing Visual Studio Build Tools on Windows, we pre-inject the
    // pure-JS @tensorflow/tfjs into the module cache under the tfjs-node key
    // so face-api resolves it without triggering native compilation.
    const tf = require('@tensorflow/tfjs');
    try {
      const tfjsNodePath = require.resolve('@tensorflow/tfjs-node');
      if (!require.cache[tfjsNodePath]) {
        require.cache[tfjsNodePath] = {
          id: tfjsNodePath, filename: tfjsNodePath, loaded: true, exports: tf,
        };
      }
    } catch (_) {
      // tfjs-node not installed at all – patch module resolver instead
      const Module = require('module');
      const origResolve = Module._resolveFilename.bind(Module);
      Module._resolveFilename = (request, ...rest) =>
        request === '@tensorflow/tfjs-node' ? require.resolve('@tensorflow/tfjs') : origResolve(request, ...rest);
    }

    const faceapi = require('@vladmandic/face-api');
    const { Canvas, Image, ImageData, loadImage } = require('canvas');

    // Patch the DOM-less Node environment so face-api can process images
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

    // Load only the three networks we need (detection → landmarks → recognition)
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);

    console.log('[KYC] face-api models loaded');
    _faceApiCache = { faceapi, loadImage };
  } catch (err) {
    console.warn('[KYC] face-api failed to load:', err.message);
    _faceApiCache = null;
  }

  return _faceApiCache;
}

// ─── OCR ──────────────────────────────────────────────────────────────────────

/**
 * Run Tesseract OCR on an image URL.
 * @param {string} imageUrl  Cloudinary (or any public) URL
 * @returns {{ text: string, confidence: number }}
 */
async function extractOcrData(imageUrl) {
  const { data } = await Tesseract.recognize(imageUrl, 'eng', {
    logger: () => {}, // silence per-progress logs
  });

  return {
    text: (data.text || '').trim(),
    confidence: Math.round(data.confidence), // 0–100
  };
}

/**
 * Parse key fields out of raw OCR text with simple regex heuristics.
 * Returns null for fields that couldn't be found.
 * @param {string} text
 * @returns {{ name: string|null, dob: string|null, idNumber: string|null }}
 */
function parseDocumentFields(text) {
  const nameMatch = text.match(/(?:name|full name|नाम)[:\s]+([A-Za-z\s]{3,40})/i);
  const dobMatch = text.match(
    /(?:dob|date of birth|born|जन्म)[:\s]+([\d]{1,2}[\/\-\.][\d]{1,2}[\/\-\.][\d]{2,4})/i,
  );
  // Citizenship / license numbers are typically alphanumeric with dashes
  const idMatch = text.match(/\b([A-Z0-9]{2,4}[-\/]?[0-9]{4,10})\b/);

  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    dob: dobMatch ? dobMatch[1].trim() : null,
    idNumber: idMatch ? idMatch[1].trim() : null,
  };
}

// ─── Face comparison ──────────────────────────────────────────────────────────

/**
 * Compare two face images and return a similarity score.
 *
 * @param {string} selfieUrl  URL of the user's selfie-with-ID image
 * @param {string} idPhotoUrl URL of the citizenship front photo
 * @returns {Promise<number|null>}  0–100 score, or null if detection failed
 */
async function compareFaces(selfieUrl, idPhotoUrl) {
  const api = await loadFaceApi();
  if (!api) return null;

  const { faceapi, loadImage } = api;

  // Download both images in parallel
  const [selfieImg, idImg] = await Promise.all([
    loadImage(selfieUrl),
    loadImage(idPhotoUrl),
  ]);

  // Detect a single face + landmarks + descriptor in each image
  const [selfieFace, idFace] = await Promise.all([
    faceapi.detectSingleFace(selfieImg).withFaceLandmarks().withFaceDescriptor(),
    faceapi.detectSingleFace(idImg).withFaceLandmarks().withFaceDescriptor(),
  ]);

  if (!selfieFace || !idFace) {
    console.warn('[KYC] Could not detect a face in one of the images');
    return null;
  }

  // Euclidean distance: 0.0 = identical, 0.6+ = different person
  const distance = faceapi.euclideanDistance(
    selfieFace.descriptor,
    idFace.descriptor,
  );

  // Map distance to 0–100 score (linear clamp)
  const score = Math.round(Math.max(0, (1 - distance / 0.6) * 100));
  return score;
}

// ─── Completeness scoring ────────────────────────────────────────────────────

/**
 * Check how many required KYC fields are present.
 * @param {string} role  'owner' | 'renter'
 * @param {object} user  User document (plain object)
 * @returns {number}  0–100
 */
function getCompletenessScore(role, user) {
  const img = user.image || {};

  const requiredFields =
    role === 'renter'
      ? [user.name, user.phone, user.citizenshipNo, user.licenseNumber,
         img.citizenshipFrontPhoto, img.selfieWithId]
      : [user.name, user.phone, img.citizenshipFront, img.selfieWithId];

  const filled = requiredFields.filter(Boolean).length;
  return Math.round((filled / requiredFields.length) * 100);
}

// ─── Trust score ─────────────────────────────────────────────────────────────

/**
 * Calculate the final 0–100 trust score.
 *
 * @param {{ ocrConfidence: number, faceScore: number|null, completenessScore: number }} params
 * @returns {number}
 */
function calculateTrustScore({ ocrConfidence, faceScore, completenessScore }) {
  const ocrPoints          = Math.round((ocrConfidence / 100) * 40);
  const facePoints         = faceScore !== null ? Math.round((faceScore / 100) * 40) : 0;
  const completenessPoints = Math.round((completenessScore / 100) * 20);

  return Math.min(100, ocrPoints + facePoints + completenessPoints);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  extractOcrData,
  parseDocumentFields,
  compareFaces,
  getCompletenessScore,
  calculateTrustScore,
};
