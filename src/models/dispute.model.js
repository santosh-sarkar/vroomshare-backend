const mongoose = require('mongoose');

const DisputeSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resolverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String },
  status: { type: String, enum: ['open', 'resolved', 'rejected'], default: 'open' },
  resolution: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Dispute', DisputeSchema);
