const mongoose = require("mongoose");
const User = require("./user.model");

// kycData is defined once on the base User schema — no need to repeat it here
const ownerSchema = new mongoose.Schema({
  image: {
    citizenshipFront: { type: String },
    citizenshipBack:  { type: String },
    profile:          { type: String },
    selfieWithId:     { type: String },
  },
  isVerified: { type: Boolean, default: false },
});

module.exports = User.discriminator("owner", ownerSchema);
