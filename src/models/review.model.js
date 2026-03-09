const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  renterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String }
}, { timestamps: true });

ReviewSchema.index({ vehicleId: 1 });

module.exports = mongoose.model('Review', ReviewSchema);
