/**
 * KYC Background Processor
 *
 * Entry point: processKyc(userId)
 *
 * Flow:
 *  1. Mark user's kycData.aiStatus = 'processing'
 *  2. Run OCR on citizenship front (+ license for renters)
 *  3. Run face comparison (selfie vs citizenship photo)
 *  4. Compute trust score
 *  5. Save everything back to the user document
 *
 * This function is designed to be called fire-and-forget after a profile
 * update – it never throws, so it cannot crash the HTTP response.
 */

const User = require('../models/users/user.model');
const {
  extractOcrData,
  parseDocumentFields,
  compareFaces,
  getCompletenessScore,
  calculateTrustScore,
} = require('./kyc.service');

/**
 * Process KYC for a single user in the background.
 * @param {string} userId  MongoDB ObjectId string
 */
async function processKyc(userId) {
  console.log(`[KYC] Starting background analysis for user ${userId}`);

  // ── 1. Mark as processing ────────────────────────────────────────────────
  try {
    await User.findByIdAndUpdate(userId, { 'kycData.aiStatus': 'processing' });
  } catch (err) {
    console.error(`[KYC] Could not mark processing for ${userId}:`, err.message);
    return;
  }

  try {
    // ── 2. Fetch user document ─────────────────────────────────────────────
    const user = await User.findById(userId).lean();
    if (!user) throw new Error('User not found');

    const { role, image = {} } = user;

    const ocrData = {};
    let ocrConfidence = 0;
    let ocrCount = 0;

    // ── 3a. OCR – citizenship front ────────────────────────────────────────
    const citizenshipUrl =
      role === 'renter' ? image.citizenshipFrontPhoto : image.citizenshipFront;

    if (citizenshipUrl) {
      const ocr = await extractOcrData(citizenshipUrl);
      ocrData.citizenship = {
        text: ocr.text,
        confidence: ocr.confidence,
        fields: parseDocumentFields(ocr.text),
      };
      ocrConfidence += ocr.confidence;
      ocrCount += 1;
    }

    // ── 3b. OCR – license (renter only) ───────────────────────────────────
    if (role === 'renter' && image.licensePhoto) {
      const ocr = await extractOcrData(image.licensePhoto);
      ocrData.license = {
        text: ocr.text,
        confidence: ocr.confidence,
        fields: parseDocumentFields(ocr.text),
      };
      ocrConfidence += ocr.confidence;
      ocrCount += 1;
    }

    // Average OCR confidence across all documents processed
    const avgOcrConfidence = ocrCount > 0 ? Math.round(ocrConfidence / ocrCount) : 0;

    // ── 4. Face comparison ────────────────────────────────────────────────
    let faceScore = null;
    let faceMatchNote = null;
    if (image.selfieWithId && citizenshipUrl) {
      const faceResult = await compareFaces(image.selfieWithId, citizenshipUrl);
      faceScore = faceResult.score;
      faceMatchNote = faceResult.note;
    }

    // ── 5. Completeness + final score ─────────────────────────────────────
    const completenessScore = getCompletenessScore(role, user);
    const finalScore = calculateTrustScore({
      ocrConfidence: avgOcrConfidence,
      faceScore,
      completenessScore,
    });

    // ── 6. Persist results ────────────────────────────────────────────────
    await User.findByIdAndUpdate(userId, {
      kycData: {
        ocrData,
        faceMatchScore: faceScore,
        faceMatchNote,
        finalScore,
        aiStatus: 'completed',
        processedAt: new Date(),
      },
    });

    console.log(
      `[KYC] Completed for user ${userId} | ` +
      `OCR=${avgOcrConfidence} Face=${faceScore ?? 'N/A'} Score=${finalScore}`,
    );
  } catch (err) {
    console.error(`[KYC] Analysis failed for user ${userId}:`, err.message);

    // Mark as failed so the admin can see it
    await User.findByIdAndUpdate(userId, { 'kycData.aiStatus': 'failed' }).catch(() => {});
  }
}

module.exports = { processKyc };
