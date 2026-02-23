const mongoose = require("mongoose");
const User = require("./user.model");

const renterSchema = new mongoose.Schema({
  //what renter should keep
  phone: { type: String, required: true },
  licenseNumber: { type: String },
  rating: { type: Number, default: 0 },
});

module.exports = User.discriminator("renter", renterSchema);
