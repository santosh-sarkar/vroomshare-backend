const mongoose = require("mongoose");

const options = { discriminatorKey: "role", timestamps: true };

// Shared sub-schema for a single OCR-processed document (citizenship / license)
const kycOcrDocSchema = new mongoose.Schema(
  {
    text:       { type: String },
    confidence: { type: Number }, // 0–100 from Tesseract
    fields: {
      name:     { type: String },
      dob:      { type: String },
      idNumber: { type: String },
    },
  },
  { _id: false },
);

const UserSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dob:      { type: Date },
    gender:   { type: String, enum: ['male', 'female', 'other'], default: null },
    address: {
      province:     { type: String },
      district:     { type: String },
      municipality: { type: String },
      wardNo:       { type: String },
    },
    phone:                        { type: String },
    isEmailVerified:              { type: Boolean, default: false },
    acceptedTerms:                { type: Boolean, default: false },
    acceptedTermsAt:              { type: Date },
    emailVerificationCode:        { type: String },
    emailVerificationCodeExpires: { type: Date },

    // AI-generated KYC analysis — shared by both owner and renter
    kycData: {
      ocrData: {
        citizenship: { type: kycOcrDocSchema }, // used by owner + renter
        license:     { type: kycOcrDocSchema }, // used by renter only
      },
      faceMatchScore: { type: Number, default: null }, // 0–100
      finalScore:     { type: Number, default: null }, // 0–100 trust score
      aiStatus: {
        type:    String,
        enum:    ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
      },
      processedAt: { type: Date },
    },
  },
  options,
);

const User = mongoose.model("User", UserSchema);

module.exports = User;
