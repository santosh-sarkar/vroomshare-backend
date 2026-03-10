const ownerService = require('../services/owner.service');
const Booking = require('../models/booking.model');

async function earnings(req, res, next) {
  try {
    const ownerId = req.user && (req.user._id || req.user.sub);
    if (!ownerId) return res.status(401).json({ message: 'Authentication required' });

    const data = await ownerService.getEarnings(ownerId);
    res.json({ ok: true, earnings: data });
  } catch (e) {
    next(e);
  }
}

async function bookings(req, res, next) {
  try {
    const ownerId = req.user && (req.user._id || req.user.sub);
    if (!ownerId) return res.status(401).json({ message: 'Authentication required' });

    const { page = 1, limit = 20, status } = req.query;
    const query = { ownerId };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(query).populate('vehicleId renterId', 'title name email').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Booking.countDocuments(query)
    ]);

    res.json({ ok: true, total, page: Number(page), limit: Number(limit), bookings });
  } catch (e) {
    next(e);
  }
}

module.exports = { earnings, bookings };
