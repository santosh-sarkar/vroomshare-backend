const mongoose = require("mongoose");
const User = require("./user.model");

const renterSchema = new mongoose.Schema({
  //what renter should keep
  phone: { type: String },
  address: { type: String },
  licenseNumber: { type: String },
  citizenshipNumber: { type: String },
  image:{
    citizenship: { type: String },
    license: { type: String },
    profile: { type: String },
  },
  isVerified: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
});

module.exports = User.discriminator("renter", renterSchema);
