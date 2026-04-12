const mongoose = require("mongoose");
const User = require("./user.model");

const renterSchema = new mongoose.Schema({
  //what renter should keep
  licenseNumber: { type: String },
  citizenshipNo: { type: String },
  image: {
    citizenshipFrontPhoto: { type: String },
    citizenshipBackPhoto: { type: String },
    licensePhoto: { type: String },
    selfiePhoto: { type: String },
  },
  isVerified: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
});

module.exports = User.discriminator("renter", renterSchema);
