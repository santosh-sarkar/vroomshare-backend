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

async function paymentSuccess(req, res, next) {
  try {
    if (!req.query.data) {
      return res.redirect(`${process.env.VERCEL_FRONTEND_URL}/failure`);
    }

    // decode base64 data
    const decodedData = JSON.parse(
      Buffer.from(req.query.data, "base64").toString("utf-8"),
    );

    console.log(decodedData);

    const {
      transaction_code,
      status,
      total_amount,
      transaction_uuid,
      product_code,
      signed_field_names,
      signature,
    } = decodedData;

    const fields = signed_field_names.split(",");

    const dataToSign = fields
      .map((field) => `${field}=${decodedData[field]}`)
      .join(",");

    console.log("dataToSign:", dataToSign);

    const booking = await Booking.findOne({
      "payment.transaction_uuid": transaction_uuid,
    });

    if (!booking) {
      return res.redirect(`${process.env.VERCEL_FRONTEND_URL}/failure`);
    }


    const expected = generateSignature(
      dataToSign,
      process.env.ESEWA_SECRET_KEY,
    );

    if (signature !== expected) {
      booking.payment.status = "failed";
      await booking.save();

      return res.redirect(`${process.env.VERCEL_FRONTEND_URL}/failure`);
    }

    // SUCCESS
    booking.payment.status = "paid";
    booking.payment.paidAt = new Date();
    booking.status = "confirmed";

    await booking.save();
    await Vehicle.findByIdAndUpdate(booking.vehicle, {
      $addToSet: {
        blockedDates: {
          from: booking.startDate,
          to: booking.endDate,
        },
      },
    });

    return res.redirect(`${process.env.VERCEL_FRONTEND_URL}/success`);
  } catch (err) {
    next(err);
  }
}

async function paymentFailure(req, res) {
  console.log("failure ma xire");
  try {
    const { transaction_uuid } = req.query;

    const booking = await Booking.findOne({
      "payment.transaction_uuid": transaction_uuid,
    });

    if (booking && booking.payment.status !== "paid") {
      booking.payment.status = "failed";
      await booking.save();
    }

    return res.redirect(`${process.env.VERCEL_FRONTEND_URL}/failure`);
  } catch (err) {
    return res.redirect(`${process.env.VERCEL_FRONTEND_URL}/failure`);
  }
}

module.exports = {
  payNow,
  paymentSuccess,
  paymentFailure,
};
