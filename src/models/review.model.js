const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  rating: Number,
  comment: String
}, { timestamps: true });

module.exports = mongoose.model('Review', ReviewSchema);
