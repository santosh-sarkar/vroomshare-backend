/**
 * KYC Worker Thread
 *
 * Receives a userId via workerData, runs the full KYC pipeline,
 * then posts the result back to the parent thread.
 *
 * Because this runs in a separate thread, the main Express event loop
 * is never blocked by Tesseract OCR or TensorFlow face-matching.
 *
 * IMPORTANT: Worker threads do NOT inherit the parent's MongoDB connection.
 * We must connect and disconnect here independently.
 */

const { workerData, parentPort } = require('worker_threads');
const mongoose = require('mongoose');
const { mongoUri } = require('../config/env');
const { processKyc } = require('./kyc.processor');

(async () => {
  try {
    await mongoose.connect(mongoUri);
    await processKyc(workerData.userId);
    parentPort.postMessage({ ok: true });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err.message });
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
