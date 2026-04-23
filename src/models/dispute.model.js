const mongoose = require('mongoose');

const DisputeSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resolverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String },
  status: { type: String, enum: ['open', 'in_review', 'escalated', 'resolved', 'rejected'], default: 'open' },
  resolution: { type: String },
  timeline: [{
    type: {
      type: String,
      enum: ['opened', 'updated', 'status_change', 'resolved', 'escalated', 'note'],
      default: 'updated'
    },
    message: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Dispute', DisputeSchema);
