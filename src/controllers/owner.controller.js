const ownerService = require('../services/owner.service');
const Booking = require('../models/booking.model');

function getOwnerId(req) {
  return req.user && (req.user._id || req.user.sub);
}

async function earnings(req, res, next) {
  try {
    const ownerId = getOwnerId(req);
    if (!ownerId) return res.status(401).json({ message: 'Authentication required' });

    const data = await ownerService.getEarnings(ownerId);
    res.json({ ok: true, earnings: data });
  } catch (e) {
    next(e);
  }
}

async function bookings(req, res, next) {
  try {
    const ownerId = getOwnerId(req);
    if (!ownerId) return res.status(401).json({ message: 'Authentication required' });

    const { page = 1, limit = 20, status } = req.query;
    const query = { owner: ownerId };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('vehicle', 'brand model photos pricing pickupAddress location')
        .populate('renter', 'name image email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(query)
    ]);

    res.json({ ok: true, total, page: Number(page), limit: Number(limit), bookings });
  } catch (e) {
    next(e);
  }
}

async function payoutSettings(req, res, next) {
  try {
    const ownerId = getOwnerId(req);
    if (!ownerId) return res.status(401).json({ message: 'Authentication required' });

    const data = await ownerService.getPayoutSettings(ownerId);
    res.json({ ok: true, ...data });
  } catch (e) {
    next(e);
  }
}

async function updatePayoutSettings(req, res, next) {
  try {
    const ownerId = getOwnerId(req);
    if (!ownerId) return res.status(401).json({ message: 'Authentication required' });

    const payoutSettingsData = await ownerService.savePayoutSettings(ownerId, req.body || {});
    res.json({ ok: true, payoutSettings: payoutSettingsData, message: 'Payout settings saved' });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ ok: false, message: e.message });
    next(e);
  }
}

async function requestPayout(req, res, next) {
  try {
    const ownerId = getOwnerId(req);
    if (!ownerId) return res.status(401).json({ message: 'Authentication required' });

    const data = await ownerService.requestPayout(ownerId, req.body || {});
    res.status(201).json({ ok: true, ...data, message: 'Payout request submitted' });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ ok: false, message: e.message });
    next(e);
  }
}

module.exports = {
  earnings,
  bookings,
  payoutSettings,
  updatePayoutSettings,
  requestPayout,
};
