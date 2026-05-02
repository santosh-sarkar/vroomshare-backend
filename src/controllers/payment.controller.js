const Booking = require("../models/booking.model");
const Vehicle = require("../models/vehicle.model");
const { generateSignature } = require("../utils/esewa");
const { v4: uuidv4 } = require("uuid");

async function payNow(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Not found" });
    }

    if (booking.status === "completed") {
      return res.json({ message: "Booking already completed" });
    }

    if (booking.status !== "approved") {
      return res.status(400).json({
        message: "Only approved bookings can be paid",
      });
    }

    if (booking.payment.status === "paid") {
      return res.json({ message: "Already paid" });
    }

    // 🔥 NEW transaction for every attempt (IMPORTANT)
    const transaction_uuid = uuidv4();

    booking.payment.transaction_uuid = transaction_uuid;
    booking.payment.status = "pending";

    await booking.save();

    const product_code = process.env.ESEWA_MERCHANT_ID;

    const total = Number(booking.totalPrice);

    const dataToSign = `total_amount=${total},transaction_uuid=${transaction_uuid},product_code=${product_code}`;

    const signature = generateSignature(
      dataToSign,
      process.env.ESEWA_SECRET_KEY,
    );

    return res.json({
      amount: total,
      total_amount: total,
      transaction_uuid,
      product_code,
      signature,
    });
  } catch (err) {
    next(err);
  }
}

// POST /payment/verify  — called by frontend success page with { data: "<base64>" }
async function verifyPayment(req, res, next) {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ ok: false, message: "Missing payment data" });

    let decodedData;
    try {
      decodedData = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
    } catch {
      return res.status(400).json({ ok: false, message: "Invalid payment data encoding" });
    }

    const {
      status,
      total_amount,
      transaction_uuid,
      product_code,
      signed_field_names,
      signature,
    } = decodedData;

    if (status !== "COMPLETE") {
      return res.status(400).json({ ok: false, message: "Payment not completed" });
    }

    const fields = signed_field_names.split(",");
    const dataToSign = fields.map((f) => `${f}=${decodedData[f]}`).join(",");
    const expected = generateSignature(dataToSign, process.env.ESEWA_SECRET_KEY);

    if (signature !== expected) {
      return res.status(400).json({ ok: false, message: "Payment signature mismatch" });
    }

    const booking = await Booking.findOne({ "payment.transaction_uuid": transaction_uuid });
    if (!booking) return res.status(404).json({ ok: false, message: "Booking not found" });

    if (booking.payment.status === "paid") {
      return res.json({ ok: true, message: "Already paid", bookingId: booking._id });
    }

    booking.payment.status = "paid";
    booking.payment.paidAt = new Date();
    booking.status = "confirmed";
    await booking.save();

    await Vehicle.findByIdAndUpdate(booking.vehicle, {
      $addToSet: { blockedDates: { from: booking.startDate, to: booking.endDate } },
    });

    return res.json({ ok: true, message: "Payment verified", bookingId: booking._id });
  } catch (err) {
    next(err);
  }
}

// POST /payment/mark-failure  — called by frontend failure page with { transaction_uuid }
async function markPaymentFailure(req, res, next) {
  try {
    const { transaction_uuid } = req.body;
    if (!transaction_uuid) return res.status(400).json({ ok: false, message: "Missing transaction_uuid" });

    const booking = await Booking.findOne({ "payment.transaction_uuid": transaction_uuid });
    if (booking && booking.payment.status !== "paid") {
      booking.payment.status = "failed";
      await booking.save();
    }

    return res.json({ ok: true, message: "Payment marked as failed" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  payNow,
  verifyPayment,
  markPaymentFailure,
};
