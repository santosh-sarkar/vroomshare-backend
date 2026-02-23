const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  make: String,
  model: String,
  year: Number,
  pricePerDay: Number,
  location: String,
  available: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Vehicle', VehicleSchema);
