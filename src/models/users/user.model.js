const mongoose = require("mongoose");

const options = { discriminatorKey: "role", timestamps: true };

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dob: { type: Date },
    address: {
      province: { type: String },
      district: { type: String },
      municipality: { type: String },
      wardNo: { type: String },
    },
    phone: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    acceptedTerms: { type: Boolean, default: false }, // ✅ Track T&C acceptance
    acceptedTermsAt: { type: Date },
    emailVerificationCode: { type: String },
    emailVerificationCodeExpires: { type: Date },
  },
  options,
);

const User = mongoose.model("User", UserSchema);

module.exports = User;
