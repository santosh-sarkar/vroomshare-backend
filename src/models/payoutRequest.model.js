const mongoose = require('mongoose');

const payoutRequestSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentMethod: {
      type: String,
      enum: ['esewa'],
      default: 'esewa',
    },
    payoutDetails: {
      esewaId: { type: String, required: true },
      accountName: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    note: { type: String, default: '' },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PayoutRequest', payoutRequestSchema);
