const mongoose = require("mongoose");
const User = require("./user.model");

const ownerSchema = new mongoose.Schema({
  //what owner should keep
  phone: { type: String},
  address: { type: String },
  isVerified: { type: Boolean, default: false },
});

module.exports = User.discriminator("owner", ownerSchema);
