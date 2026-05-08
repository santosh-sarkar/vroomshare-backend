const Booking = require("../models/booking.model");
const Vehicle = require("../models/vehicle.model");
const Dispute = require("../models/dispute.model");
const Renter = require("../models/users/renter.model");
const { sendBookingApprovedPaymentEmail, sendBookingRequestEmail } = require("../services/email.service");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(start, end) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const diff = Math.ceil((e - s) / MS_PER_DAY);
  return diff > 0 ? diff : 0;
}

function toDisplayId(id) {
  return `DIS-${String(id).slice(-6).toUpperCase()}`;
}

async function attachExistingDisputes(items) {
  const records = Array.isArray(items) ? items : [items];
  const validBookings = records.filter(Boolean);

  if (validBookings.length === 0) {
    return items;
  }

  const bookingIds = validBookings.map((booking) => booking._id);
  const disputes = await Dispute.find({ bookingId: { $in: bookingIds } })
    .select('_id bookingId status createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();

  const disputeByBookingId = new Map();
  for (const dispute of disputes) {
    const bookingId = String(dispute.bookingId);
    if (!disputeByBookingId.has(bookingId)) {
      disputeByBookingId.set(bookingId, {
        _id: dispute._id,
        displayId: toDisplayId(dispute._id),
        status: dispute.status,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
      });
    }
  }

  validBookings.forEach((booking) => {
    booking.existingDispute = disputeByBookingId.get(String(booking._id)) || null;
  });

  return items;
}

function buildPaymentUrl() {
  const frontendUrl = process.env.VERCEL_FRONTEND_URL;
  if (!frontendUrl) {
    return null;
  }

  return `${frontendUrl.replace(/\/$/, "")}/user/trips`;
}

// Create a booking (renter)
async function create(req, res, next) {
  try {
    const renterId = req.user && (req.user._id || req.user.sub);
    const { vehicleId, startDate, endDate } = req.body;


    if (!renterId)
      return res.status(401).json({ message: "please login first" });

    const renter = await Renter.findById(renterId).select('isVerified').lean();
    if (!renter || !renter.isVerified)
      return res.status(403).json({ ok: false, message: "KYC verification required before booking. Please complete your identity verification." });

    if (!vehicleId || !startDate || !endDate)
      return res
        .status(400)
        .json({ message: "vehicleId, startDate and endDate are required" });

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    // SAFE DATE NORMALIZATION
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    // DUPLICATE REQUEST CHECK — same renter, same vehicle, still active
    const existingRequest = await Booking.findOne({
      vehicle: vehicleId,
      renter: renterId,
      status: { $in: ["requested", "approved", "confirmed", "ongoing"] },
    });

    if (existingRequest) {
      return res.status(409).json({
        ok: false,
        message: "You already have an active booking request for this vehicle.",
        existingBookingId: existingRequest._id,
        existingStatus: existingRequest.status,
      });
    }

    // OVERLAP CHECK (correct)
    const overlapping = await Booking.findOne({
      vehicle: vehicleId,
      status: { $in: ["approved", "confirmed"] },
      startDate: { $lt: end },
      endDate: { $gt: start },
    });

    if (overlapping) {
      return res
        .status(400)
        .json({ message: "Vehicle already booked for given dates" });
    }

    await Vehicle.findByIdAndUpdate(vehicleId, {
          $addToSet: {
            blockedDates: {
              from: start,
              to: end,
            },
          },
        });

    // SAFE NIGHT CALCULATION
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const totalPrice = nights * (vehicle.pricing?.dailyRate || 0);

    const booking = await Booking.create({
      vehicle: vehicle._id,
      renter: renterId,
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

    // Notify owner about the new booking request (fire-and-forget)
    try {
      const Owner = require("../models/users/owner.model");
      const owner = await Owner.findById(vehicle.owner).select("name email").lean();
      if (owner && owner.email) {
        const renter = await Renter.findById(renterId).select("name").lean();
        const dashboardUrl = process.env.VERCEL_FRONTEND_URL
          ? `${process.env.VERCEL_FRONTEND_URL.replace(/\/$/, "")}/owner/bookings`
          : null;
        await sendBookingRequestEmail(owner.email, {
          ownerName: owner.name || "Owner",
          renterName: renter && renter.name ? renter.name : "A renter",
          vehicleName: `${vehicle.brand || ""} ${vehicle.model || ""}`.trim(),
          startDate: start,
          endDate: end,
          totalPrice,
          platformFeeRate: 0.15,
          bookingId: String(booking._id),
          dashboardUrl,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send booking request email to owner:", emailErr && emailErr.message ? emailErr.message : emailErr);
    }
  } catch (e) {
    next(e);
  }
}

// Get booking by id (renter/owner/admin)
async function get(req, res, next) {
  try {
    const authUserId = req.user && (req.user._id || req.user.sub);

    if (!req.params.id) return res.status(400).json({ message: "id is required" });

    const booking = await Booking.findById(req.params.id)
      .populate({
        path: "vehicle",
        select: "model brand registrationNumber photos pricing",
      })
      .populate({
        path: "owner",
        select: "name image email createdAt",
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

    await attachExistingDisputes(booking);

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
    const bookings = await Booking.find({ renter: renterId })
      .populate({
        path: "vehicle",
        select: "model brand photos pickup pricing",
      })
      .populate({
        path: "owner",
        select: "name image email",
      })
      .sort({ createdAt: -1 });

    await attachExistingDisputes(bookings);

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

    const { status, period = 'all', page = 1, limit = 10 } = req.query;
    const query = { owner: ownerId };

    if (status && status !== 'all') {
      const statusMap = {
        awaiting: 'requested',
        requested: 'requested',
        approved: 'approved',
        confirmed: 'confirmed',
        progress: ['confirmed', 'ongoing'],
        ongoing: 'ongoing',
        completed: 'completed',
        cancelled: 'cancelled',
      };

      const resolvedStatus = statusMap[status] || status;
      query.status = Array.isArray(resolvedStatus)
        ? { $in: resolvedStatus }
        : resolvedStatus;
    }

    if (period && period !== 'all') {
      const now = new Date();
      const fromDate = new Date();

      if (period === '7d') {
        fromDate.setDate(now.getDate() - 7);
      } else if (period === '30d') {
        fromDate.setDate(now.getDate() - 30);
      } else if (period === '90d') {
        fromDate.setDate(now.getDate() - 90);
      }

      if (['7d', '30d', '90d'].includes(period)) {
        query.createdAt = { $gte: fromDate, $lte: now };
      }
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate({
          path: "vehicle",
          select: "model brand registrationNumber photos",
        })
        .populate({
          path: "renter",
          select: "name image email",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Booking.countDocuments(query),
    ]);

    await attachExistingDisputes(bookings);

    res.json({ ok: true, total, page: pageNum, limit: limitNum, bookings });
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
    if (!authUserId || (booking.owner && booking.owner.toString() !== authUserId.toString())) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const vehicle = await Vehicle.findById(booking.vehicle);
   if (!vehicle) return res.status(404).json({ message: "Associated vehicle not found" });

    const { action } = req.body;
    if (!action) return res.status(400).json({ message: "action is required" });

    const allowedTransitions = {
      requested: ["approve", "cancel"],
      approved: [],
      confirmed: ["ongoing"],
      ongoing: ["complete"],
      completed: [],
      cancelled: [],
    };

    const currentStatus = booking.status;
    const permittedActions = allowedTransitions[currentStatus] || [];

    if (!permittedActions.includes(action)) {
      return res.status(400).json({
        message: `Action \"${action}\" is not allowed for booking status \"${currentStatus}\"`,
      });
    }

    if (action === "approve") {
      booking.status = "approved";
      booking.completedAt = null;
    } else if (action === "cancel") {
      booking.status = "cancelled";
      booking.completedAt = null;
      await Vehicle.findByIdAndUpdate(booking.vehicle, {
        $pull: {
          blockedDates: {
            from: booking.startDate,
            to: booking.endDate,
          },
        },
      });
      
    } else if (action === "ongoing") {
      booking.status = "ongoing";
      booking.completedAt = null;
    } else if (action === "complete") {
      booking.status = "completed";
      booking.completedAt = new Date();
      vehicle.blockedDates = vehicle.blockedDates.filter(
        (bd) =>
          !(
            bd.from.getTime() === booking.startDate.getTime() &&
            bd.to.getTime() === booking.endDate.getTime()
          )
      );
      await vehicle.save();
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await booking.save();

    if (action === "approve") {
      try {
        const renter = await Renter.findById(booking.renter)
          .select("name email")
          .lean();

        if (renter?.email) {
          const vehicleName = [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "your booked vehicle";

          await sendBookingApprovedPaymentEmail(renter.email, {
            userName: renter.name || "User",
            vehicleName,
            startDate: booking.startDate,
            endDate: booking.endDate,
            totalPrice: booking.totalPrice,
            bookingId: booking._id.toString(),
            paymentUrl: buildPaymentUrl(),
          });
        }
      } catch (emailError) {
        console.error(
          `Failed to send booking approval payment email for booking ${booking._id}:`,
          emailError && emailError.message ? emailError.message : emailError,
        );
      }
    }

    if (booking.status === "completed") {
      await Vehicle.findByIdAndUpdate(booking.vehicle, {
        $pull: {
          blockedDates: {
            from: booking.startDate,
            to: booking.endDate,
          },
        },
      });
    }

    res.json({ ok: true, msg: booking.status });
  } catch (e) {
    next(e);
  }
}

// Check if renter has an active booking for a vehicle
async function checkVehicleBookingStatus(req, res, next) {
  try {
    const renterId = req.user && (req.user._id || req.user.sub);
    if (!renterId) return res.status(401).json({ ok: false, message: "Authentication required" });

    const { vehicleId } = req.params;
    if (!vehicleId) return res.status(400).json({ ok: false, message: "vehicleId is required" });

    const existing = await Booking.findOne({
      vehicle: vehicleId,
      renter: renterId,
      status: { $in: ["requested", "approved", "confirmed", "ongoing"] },
    }).select("status _id startDate endDate totalPrice").lean();

    res.json({
      ok: true,
      hasActiveBooking: !!existing,
      status: existing ? existing.status : null,
      bookingId: existing ? existing._id : null,
      startDate: existing ? existing.startDate : null,
      endDate: existing ? existing.endDate : null,
      totalPrice: existing ? existing.totalPrice : null,
    });
  } catch (e) {
    next(e);
  }
}

// Cancel booking by renter (only when status is "requested")
async function cancelByRenter(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ ok: false, message: 'Booking not found' });

    const renterId = req.user && (req.user._id || req.user.sub);
    if (!renterId || booking.renter.toString() !== renterId.toString()) {
      return res.status(403).json({ ok: false, message: 'Not authorized' });
    }

    if (booking.status !== 'requested') {
      return res.status(400).json({ ok: false, message: `Cannot cancel a booking with status "${booking.status}"` });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ ok: true, message: 'Booking cancelled successfully' });
  } catch (e) {
    next(e);
  }
}

module.exports = { create, get, renterBookings, ownerBookings, update, checkVehicleBookingStatus, cancelByRenter };
