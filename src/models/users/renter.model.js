const mongoose = require("mongoose");
const User = require("./user.model");

// kycData is defined once on the base User schema — no need to repeat it here
const renterSchema = new mongoose.Schema({
  licenseNumber: { type: String },
  citizenshipNo: { type: String },
  image: {
    citizenshipFrontPhoto: { type: String },
    citizenshipBackPhoto:  { type: String },
    licensePhoto:          { type: String },
    profile:               { type: String },
    selfieWithId:          { type: String },
  },
  isVerified: { type: Boolean, default: false },
  rating:    { type: Number, default: 0 },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" }],
});

module.exports = User.discriminator("renter", renterSchema);
