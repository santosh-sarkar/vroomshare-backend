const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  amount: Number,
  provider: String,
  status: String
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
