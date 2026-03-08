const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  vehicleType: { type: String },
  location: { type: String },
  pricePerDay: { type: Number, required: true },
  images: [{ type: String }],
  availability: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Vehicle', VehicleSchema);
