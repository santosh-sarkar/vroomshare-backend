const mongoose = require("mongoose");
const User = require("./user.model");

const ownerSchema = new mongoose.Schema({
  //what owner should keep
  image: {
    citizenshipFront: { type: String },
    citizenshipBack: { type: String },
    profile: { type: String },
  },
  isVerified: { type: Boolean, default: false },
});

module.exports = User.discriminator("owner", ownerSchema);
