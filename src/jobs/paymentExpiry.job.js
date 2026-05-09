const Booking = require("../models/booking.model");
const Vehicle = require("../models/vehicle.model");
const User = require("../models/users/user.model");
const { sendBookingAutoCancelledEmail, sendBookingRequestExpiredEmail } = require("../services/email.service");

const PAYMENT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const CHECK_INTERVAL_MS = 5 * 60 * 1000;       // check every 5 minutes

async function cancelExpiredApprovedBookings() {
  const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MS);

  // Find all approved bookings where payment is still pending and 2+ hours have passed.
  // approvedAt may be null for bookings approved before the field was added — fall back to updatedAt.
  const expired = await Booking.find({
    status: "approved",
    "payment.status": "pending",
    $or: [
      { approvedAt: { $ne: null, $lte: cutoff } },
      { approvedAt: null, updatedAt: { $lte: cutoff } },
    ],
  }).populate("renter", "name email").populate("vehicle", "name").lean();

  if (expired.length === 0) return;

  const ids = expired.map((b) => b._id);

  // Bulk cancel
  await Booking.updateMany(
    { _id: { $in: ids } },
    { $set: { status: "cancelled" } }
  );

  // Unblock dates for each cancelled booking
  for (const booking of expired) {
    try {
      await Vehicle.findByIdAndUpdate(booking.vehicle, {
        $pull: {
          blockedDates: {
            from: booking.startDate,
            to: booking.endDate,
          },
        },
      });
    } catch (err) {
      console.error(`[PaymentExpiry] Failed to unblock dates for vehicle ${booking.vehicle}:`, err.message);
    }
  }

  console.log(`[PaymentExpiry] Auto-cancelled ${expired.length} unpaid booking(s) after 2-hour payment window.`);

  // Send cancellation emails to renters
  for (const booking of expired) {
    try {
      const renter = booking.renter;
      if (renter && renter.email) {
        await sendBookingAutoCancelledEmail(renter.email, {
          renterName: renter.name || "Renter",
          vehicleName: booking.vehicle?.name || "Vehicle",
          startDate: booking.startDate,
          endDate: booking.endDate,
          totalPrice: booking.totalPrice,
          bookingId: booking._id,
        });
      }
    } catch (err) {
      console.error(`[PaymentExpiry] Failed to send cancellation email for booking ${booking._id}:`, err.message);
    }
  }
}

async function cancelExpiredRequestedBookings() {
  const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MS);

  // Find requested bookings where the owner has not responded within 2 hours
  const expired = await Booking.find({
    status: "requested",
    createdAt: { $lte: cutoff },
  }).populate("renter", "name email").populate("vehicle", "name").lean();

  if (expired.length === 0) return;

  const ids = expired.map((b) => b._id);

  // Bulk cancel
  await Booking.updateMany(
    { _id: { $in: ids } },
    { $set: { status: "cancelled" } }
  );

  // Unblock dates for each cancelled booking (added at request time)
  for (const booking of expired) {
    try {
      await Vehicle.findByIdAndUpdate(booking.vehicle, {
        $pull: {
          blockedDates: {
            from: booking.startDate,
            to: booking.endDate,
          },
        },
      });
    } catch (err) {
      console.error(`[RequestExpiry] Failed to unblock dates for vehicle ${booking.vehicle}:`, err.message);
    }
  }

  console.log(`[RequestExpiry] Auto-cancelled ${expired.length} unanswered booking request(s) after 2-hour owner response window.`);

  // Send expiry emails to renters
  for (const booking of expired) {
    try {
      const renter = booking.renter;
      if (renter && renter.email) {
        await sendBookingRequestExpiredEmail(renter.email, {
          renterName: renter.name || "Renter",
          vehicleName: booking.vehicle?.name || "Vehicle",
          startDate: booking.startDate,
          endDate: booking.endDate,
          totalPrice: booking.totalPrice,
          bookingId: booking._id,
        });
      }
    } catch (err) {
      console.error(`[RequestExpiry] Failed to send expiry email for booking ${booking._id}:`, err.message);
    }
  }
}

function startPaymentExpiryJob() {
  // Run once immediately on startup, then on interval
  cancelExpiredApprovedBookings().catch((err) =>
    console.error("[PaymentExpiry] Initial run failed:", err.message)
  );
  cancelExpiredRequestedBookings().catch((err) =>
    console.error("[RequestExpiry] Initial run failed:", err.message)
  );

  setInterval(() => {
    cancelExpiredApprovedBookings().catch((err) =>
      console.error("[PaymentExpiry] Run failed:", err.message)
    );
    cancelExpiredRequestedBookings().catch((err) =>
      console.error("[RequestExpiry] Run failed:", err.message)
    );
  }, CHECK_INTERVAL_MS);

  console.log("[PaymentExpiry & RequestExpiry] Job started — checks every 5 minutes, cancels after 2 hours.");
}

module.exports = { startPaymentExpiryJob };
