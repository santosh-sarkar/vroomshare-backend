const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    renter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ["requested", "approved", "confirmed","ongoing", "cancelled", "completed"],
      default: "requested",
    },
    payment: {
      status: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded"],
        default: "pending",
      },
      transaction_uuid: {
        type: String,
        index: true,
      },
      method: { type: String, default: "esewa" },
      paidAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", BookingSchema);
