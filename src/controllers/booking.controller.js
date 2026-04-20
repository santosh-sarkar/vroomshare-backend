const Booking = require("../models/booking.model");
const Vehicle = require("../models/vehicle.model");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(start, end) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const diff = Math.ceil((e - s) / MS_PER_DAY);
  return diff > 0 ? diff : 0;
}

// Create a booking (renter)
async function create(req, res, next) {
  try {
    const renterId = req.user && (req.user._id || req.user.sub);
    const { vehicleId, startDate, endDate } = req.body;

    console.log(renterId, vehicleId, startDate, endDate);

    if (!renterId)
      return res.status(401).json({ message: "please login first" });

    if (!vehicleId || !startDate || !endDate)
      return res
        .status(400)
        .json({ message: "vehicleId, startDate and endDate are required" });

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    // if (!vehicle.availability)
    //   return res.status(400).json({ message: 'Vehicle not available' });

    // SAFE DATE NORMALIZATION
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    // OVERLAP CHECK (correct)
    const overlapping = await Booking.findOne({
      vehicleId,
      status: { $in: ["approved", "confirmed"] },
      startDate: { $lt: end },
      endDate: { $gt: start },
    });

    if (overlapping) {
      return res
        .status(400)
        .json({ message: "Vehicle already booked for given dates" });
    }

    // SAFE NIGHT CALCULATION
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const totalPrice = nights * (vehicle.pricing?.dailyRate || 0);

    const booking = await Booking.create({
      vehicle,
      renter,
      owner: vehicle.owner,
      startDate: start,
      endDate: end,
      totalPrice,
      status: "requested",
      payment: {
        status: "pending",
      },
    });

    res
      .status(201)
      .json({ ok: true, msg: "Booking created successfully", booking });
  } catch (e) {
    next(e);
  }
}

// Get booking by id (renter/owner/admin)
async function get(req, res, next) {
  try {
    const authUserId = req.user && (req.user._id || req.user.sub);

    const booking = await Booking.findById(req.params.id)
      .populate({
        path: "vehicle",
        select: "model brand registrationNumber photos pricing",
      })
      .populate({
        path: "renter",
        select: "name image email createdAt",
      });

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const role = req.user && req.user.role;

    if (role !== "admin" && authUserId) {
      const isOwner =
        booking.owner && booking.owner._id.toString() === authUserId.toString();
      const isRenter =
        booking.renter && booking.renter._id.toString() === authUserId.toString();
      if (!isOwner && !isRenter)
        return res.status(403).json({ message: "Access forbidden" });
    }

    res.json({ ok: true, booking });
  } catch (e) {
    next(e);
  }
}

// Get bookings for renter
async function renterBookings(req, res, next) {
  try {
    const renterId = req.user && (req.user._id || req.user.sub);
    if (!renterId)
      return res.status(401).json({ message: "Authentication required" });
    const bookings = await Booking.find({ renterId }).sort({ createdAt: -1 });
    res.json({ ok: true, total: bookings.length, bookings });
  } catch (e) {
    next(e);
  }
}

// Get bookings for owner
async function ownerBookings(req, res, next) {
  try {
    const ownerId = req.user && (req.user._id || req.user.sub);
    if (!ownerId)
      return res.status(401).json({ message: "Authentication required" });
    const bookings = await Booking.find({ owner: ownerId })
      .populate({
        path: "vehicle",
        select: "model brand registrationNumber photos",
      })
      .populate({
        path: "renter",
        select: "name image email",
      })
      .sort({ createdAt: -1 });

    if (bookings.length === 0) {
      return res.status(404).json({ message: "No bookings found" });
    }

    res.json({ ok: true, total: bookings.length, bookings });
  } catch (e) {
    next(e);
  }
}

// Update booking status (owner actions)
async function update(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const authUserId = req.user && (req.user._id || req.user.sub);
    if (
      !authUserId ||
      (booking.ownerId && booking.ownerId.toString() !== authUserId.toString())
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { action } = req.body; // expected values: confirm, cancel, complete
    if (!action) return res.status(400).json({ message: "action is required" });

    if (action === "approve") {
      booking.status = "approved";
    } else if (action === "cancel") {
      booking.status = "cancelled";
    } else if (action === "complete") {
      booking.status = "completed";
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await booking.save();
    res.json({ ok: true, msg: booking.status });
  } catch (e) {
    next(e);
  }
}

module.exports = { create, get, renterBookings, ownerBookings, update };
