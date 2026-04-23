const User = require('../models/users/user.model');
const Vehicle = require('../models/vehicle.model');
const Booking = require('../models/booking.model');
const Dispute = require('../models/dispute.model');

const DISPUTE_STATUSES = ['open', 'in_review', 'escalated', 'resolved', 'rejected'];

function normalizeDispute(disputeDoc) {
  if (!disputeDoc) return null;

  const dispute = disputeDoc.toObject ? disputeDoc.toObject() : disputeDoc;
  const booking = dispute.bookingId || {};

  const status = dispute.status || 'open';
  const statusMap = {
    open: { label: 'Open', tone: 'warning' },
    in_review: { label: 'In Review', tone: 'info' },
    escalated: { label: 'Escalated', tone: 'danger' },
    resolved: { label: 'Resolved', tone: 'success' },
    rejected: { label: 'Rejected', tone: 'neutral' },
  };

  return {
    ...dispute,
    displayId: `DIS-${String(dispute._id).slice(-6).toUpperCase()}`,
    booking,
    renter: booking.renter || null,
    owner: booking.owner || null,
    vehicle: booking.vehicle || null,
    statusMeta: statusMap[status] || statusMap.open,
  };
}

async function stats(req, res, next) {
  try {
    const users = await User.countDocuments();
    const vehicles = await Vehicle.countDocuments();
    const bookings = await Booking.countDocuments();
    res.json({ ok: true, stats: { users, vehicles, bookings } });
  } catch (e) {
    next(e);
  }
}

// Verify a user (owner or renter)
async function verifyUser(req, res, next) {
  try {
    const id = req.params.id;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // set isVerified when schema supports it (discriminator)
    user.isVerified = true;
    await user.save();
    res.json({ ok: true, user });
  } catch (e) { next(e); }
}

// Get all pending users (owner/renter) awaiting verification
async function getPendingUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {
      role: { $in: ['owner', 'renter'] },
      isVerified: false,
    };

    if (search && search.trim()) {
      const keyword = search.trim();
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email role phone createdAt isVerified image citizenshipNo licenseNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ ok: true, total, page: Number(page), limit: Number(limit), users });
  } catch (e) { next(e); }
}

// Get a single user submission for verification
async function getPendingUserById(req, res, next) {
  try {
    const id = req.params.id;
    const user = await User.findOne({ _id: id, role: { $in: ['owner', 'renter'] } })
      .select('-password -__v')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ ok: true, user });
  } catch (e) { next(e); }
}

// Get all vehicles pending admin verification (submitted but not yet verified)
async function getPendingVehicles(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = { status: 'pending', isVerified: false };

    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .populate('owner', 'name email phone')
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .exec(),
      Vehicle.countDocuments(filter)
    ]);

    res.json({ ok: true, total, page: Number(page), limit: Number(limit), vehicles });
  } catch (e) { next(e); }
}

// Verify a vehicle listing
async function verifyVehicle(req, res, next) {
  try {
    const id = req.params.id;
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    vehicle.isVerified = true;
    vehicle.status = 'active';
    await vehicle.save();
    res.json({ ok: true, vehicle });
  } catch (e) { next(e); }
}

// Reject a vehicle listing and remove it from pending queue
async function rejectVehicle(req, res, next) {
  try {
    const id = req.params.id;
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    vehicle.isVerified = false;
    vehicle.status = 'suspended';
    await vehicle.save();

    res.json({ ok: true, vehicle, message: 'Vehicle listing rejected' });
  } catch (e) { next(e); }
}

// Create a dispute (only renter or owner can create)
async function createDispute(req, res, next) {
  try {
    const reporterId = req.user && (req.user._id || req.user.sub);
    const reporterRole = req.user && req.user.role;
    const { bookingId, reason } = req.body;
    if (!reporterId) return res.status(401).json({ message: 'Authentication required' });
    if (!bookingId) return res.status(400).json({ message: 'bookingId required' });

    if (!['renter', 'owner'].includes(String(reporterRole))) {
      return res.status(403).json({ message: 'Only renter or owner can create disputes' });
    }

    const booking = await Booking.findById(bookingId).select('renter owner').lean();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const isParticipant = [String(booking.renter), String(booking.owner)].includes(String(reporterId));
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not allowed to create dispute for this booking' });
    }

    const existingOpenDispute = await Dispute.findOne({
      bookingId,
      status: { $in: ['open', 'in_review', 'escalated'] },
    }).lean();

    if (existingOpenDispute) {
      return res.status(409).json({ message: 'An active dispute already exists for this booking' });
    }

    const reporter = await User.findById(reporterId).select('name').lean();

    const dispute = await Dispute.create({
      bookingId,
      reporterId,
      reason,
      status: 'open',
      timeline: [{
        type: 'opened',
        message: reason ? `Dispute opened: ${reason}` : 'Dispute opened',
        actorId: reporterId,
        actorName: reporter && reporter.name,
        at: new Date(),
      }],
    });

    res.status(201).json({ ok: true, dispute: normalizeDispute(dispute), message: 'Dispute created successfully' });
  } catch (e) { next(e); }
}

// List disputes for admin management screen
async function getDisputes(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      reason,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status && DISPUTE_STATUSES.includes(String(status))) filter.status = String(status);
    if (reason && String(reason).trim()) filter.reason = new RegExp(String(reason).trim(), 'i');

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      const matchingUsers = await User.find({ name: searchRegex }).select('_id').lean();
      const userIds = matchingUsers.map(u => u._id);
      const matchingBookings = await Booking.find({ $or: [{ renter: { $in: userIds } }, { owner: { $in: userIds } }] }).select('_id').lean();
      const bookingIds = matchingBookings.map(b => b._id);

      const byObjectId = /^[a-f\d]{24}$/i.test(String(search).trim()) ? [String(search).trim()] : [];
      filter.$or = [
        { _id: { $in: byObjectId } },
        { bookingId: { $in: bookingIds } },
        { reason: searchRegex },
      ];
    }

    const sort = { [sortBy]: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 };

    const [rows, total] = await Promise.all([
      Dispute.find(filter)
        .populate({
          path: 'bookingId',
          select: 'startDate endDate totalPrice status renter owner vehicle',
          populate: [
            { path: 'renter', select: 'name email image role' },
            { path: 'owner', select: 'name email image role' },
            { path: 'vehicle', select: 'brand model registrationNumber type' },
          ],
        })
        .populate('reporterId', 'name email role')
        .populate('resolverId', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Dispute.countDocuments(filter),
    ]);

    res.json({
      ok: true,
      page: pageNum,
      limit: limitNum,
      total,
      disputes: rows.map(normalizeDispute),
    });
  } catch (e) { next(e); }
}

// Dispute stats for dashboard cards
async function getDisputeStats(req, res, next) {
  try {
    const grouped = await Dispute.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const stats = {
      total: 0,
      open: 0,
      in_review: 0,
      escalated: 0,
      resolved: 0,
      rejected: 0,
    };

    for (const item of grouped) {
      if (stats[item._id] !== undefined) stats[item._id] = item.count;
      stats.total += item.count;
    }

    res.json({ ok: true, stats });
  } catch (e) { next(e); }
}

// Single dispute detail for detail screen
async function getDisputeById(req, res, next) {
  try {
    const { id } = req.params;
    const dispute = await Dispute.findById(id)
      .populate({
        path: 'bookingId',
        select: 'startDate endDate totalPrice status renter owner vehicle payment',
        populate: [
          { path: 'renter', select: 'name email phone image role' },
          { path: 'owner', select: 'name email phone image role' },
          { path: 'vehicle', select: 'brand model registrationNumber type photos status' },
        ],
      })
      .populate('reporterId', 'name email phone role')
      .populate('resolverId', 'name email phone role')
      .populate('timeline.actorId', 'name email role');

    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

    const normalized = normalizeDispute(dispute);
    const timeline = (dispute.timeline || []).map((event) => ({
      type: event.type,
      message: event.message,
      at: event.at,
      actor: event.actorId || null,
      actorName: event.actorName || (event.actorId && event.actorId.name) || 'System',
    }));

    res.json({ ok: true, dispute: normalized, timeline });
  } catch (e) { next(e); }
}

// Resolve a dispute (admin)
async function resolveDispute(req, res, next) {
  try {
    const id = req.params.id;
    const { resolution, action, status = 'resolved' } = req.body; // action could be 'refund','cancel','none'
    const resolverId = req.user && (req.user._id || req.user.sub);
    const dispute = await Dispute.findById(id).populate('bookingId', 'status');
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

    if (!DISPUTE_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${DISPUTE_STATUSES.join(', ')}` });
    }

    const resolver = resolverId ? await User.findById(resolverId).select('name').lean() : null;

    dispute.resolverId = resolverId;
    dispute.resolution = resolution;
    dispute.status = status;
    dispute.timeline = dispute.timeline || [];
    dispute.timeline.push({
      type: status === 'resolved' ? 'resolved' : status === 'escalated' ? 'escalated' : 'status_change',
      message: resolution || `Status changed to ${status}`,
      actorId: resolverId,
      actorName: resolver && resolver.name,
      at: new Date(),
    });
    await dispute.save();

    // optional actions on booking
    if (action === 'cancel') {
      await Booking.findByIdAndUpdate(dispute.bookingId, { status: 'cancelled' });
    }

    const updated = await Dispute.findById(dispute._id)
      .populate({
        path: 'bookingId',
        select: 'startDate endDate totalPrice status renter owner vehicle',
        populate: [
          { path: 'renter', select: 'name email image role' },
          { path: 'owner', select: 'name email image role' },
          { path: 'vehicle', select: 'brand model registrationNumber type' },
        ],
      })
      .populate('reporterId', 'name email role')
      .populate('resolverId', 'name email role')
      .lean();

    res.json({ ok: true, dispute: normalizeDispute(updated) });
  } catch (e) { next(e); }
}

// Reject a user KYC submission
async function rejectUser(req, res, next) {
  try {
    const id = req.params.id;
    const user = await User.findOne({ _id: id, role: { $in: ['owner', 'renter'] } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isVerified = false;
    await user.save();
    res.json({ ok: true, message: 'User verification rejected', user });
  } catch (e) { next(e); }
}

module.exports = {
  stats,
  verifyUser,
  rejectUser,
  getPendingUsers,
  getPendingUserById,
  verifyVehicle,
  rejectVehicle,
  getPendingVehicles,
  createDispute,
  getDisputes,
  getDisputeStats,
  getDisputeById,
  resolveDispute,
};
