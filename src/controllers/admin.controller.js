const User = require('../models/users/user.model');
const Vehicle = require('../models/vehicle.model');
const Booking = require('../models/booking.model');
const Dispute = require('../models/dispute.model');
const {
  sendKycReviewEmail,
  sendVehicleReviewEmail,
  sendDisputeNotificationEmail,
} = require('../services/email.service');

const DISPUTE_STATUSES = ['open', 'in_review', 'escalated', 'resolved', 'rejected'];
const ACTIVE_DISPUTE_STATUSES = ['open', 'in_review', 'escalated'];
const CLOSED_DISPUTE_STATUSES = ['resolved', 'rejected'];
const DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000;

function getDisputeAccess(booking, now = new Date()) {
  if (!booking) {
    return { allowed: false, message: 'Booking not found' };
  }

  const status = String(booking.status || '').toLowerCase();
  const startDate = booking.startDate ? new Date(booking.startDate) : null;
  const endDate = booking.endDate ? new Date(booking.endDate) : null;
  const completedAt = booking.completedAt ? new Date(booking.completedAt) : null;
  const updatedAt = booking.updatedAt ? new Date(booking.updatedAt) : null;

  const hasValidDates =
    startDate instanceof Date &&
    !Number.isNaN(startDate.valueOf()) &&
    endDate instanceof Date &&
    !Number.isNaN(endDate.valueOf());

  const isOngoing =
    status === 'ongoing' ||
    (status === 'confirmed' && hasValidDates && now >= startDate && now <= endDate);

  if (isOngoing) {
    return {
      allowed: true,
      actionLabel: 'Report Issue',
      mode: 'issue',
    };
  }

  const completedReference =
    completedAt instanceof Date && !Number.isNaN(completedAt.valueOf())
      ? completedAt
      : updatedAt instanceof Date && !Number.isNaN(updatedAt.valueOf()) && status === 'completed'
        ? updatedAt
      : endDate instanceof Date && !Number.isNaN(endDate.valueOf())
        ? endDate
        : null;

  if (status === 'completed' && completedReference) {
    const expiresAt = new Date(completedReference.getTime() + DISPUTE_WINDOW_MS);

    if (now <= expiresAt) {
      return {
        allowed: true,
        actionLabel: 'Raise Dispute',
        mode: 'dispute',
        expiresAt,
      };
    }

    return {
      allowed: false,
      message: 'Disputes for completed bookings must be raised within 48 hours of trip completion',
      mode: 'expired',
      expiresAt,
    };
  }

  return {
    allowed: false,
    message: 'You can report an issue only during an ongoing trip or raise a dispute within 48 hours after completion',
    mode: 'unavailable',
  };
}

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

function parseIncidentAt(incidentAt) {
  if (!incidentAt) return null;

  const parsed = new Date(incidentAt);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
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

    if (user.email) {
      sendKycReviewEmail(user.email, {
        userName: user.name || 'User',
        status: 'approved',
        role: user.role,
      }).catch((emailError) => {
        console.error(
          `Failed to send KYC approval email for user ${user._id}:`,
          emailError && emailError.message ? emailError.message : emailError,
        );
      });
    }

    res.json({ ok: true, user });
  } catch (e) { next(e); }
}

// Get all pending users (owner/renter) awaiting verification
async function getPendingUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const hasAnyKycSubmission = {
      $or: [
        // Owner KYC fields
        { 'image.citizenshipFront': { $exists: true, $ne: '' } },
        { 'image.citizenshipBack': { $exists: true, $ne: '' } },
        { 'image.selfieWithId': { $exists: true, $ne: '' } },

        // Renter KYC fields
        { citizenshipNo: { $exists: true, $ne: '' } },
        { licenseNumber: { $exists: true, $ne: '' } },
        { 'image.citizenshipFrontPhoto': { $exists: true, $ne: '' } },
        { 'image.citizenshipBackPhoto': { $exists: true, $ne: '' } },
        { 'image.licensePhoto': { $exists: true, $ne: '' } },
      ],
    };

    const filter = {
      role: { $in: ['owner', 'renter'] },
      isVerified: false,
      ...hasAnyKycSubmission,
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
        .select('name email role phone createdAt isVerified image citizenshipNo licenseNumber kycData')
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
      .select('-password -__v') // kycData is included by default (not excluded)
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
    const vehicle = await Vehicle.findById(id).populate('owner', 'name email');
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    vehicle.isVerified = true;
    vehicle.status = 'active';
    await vehicle.save();

    if (vehicle.owner?.email) {
      const vehicleName = [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Vehicle Listing';

      sendVehicleReviewEmail(vehicle.owner.email, {
        userName: vehicle.owner.name || 'User',
        status: 'approved',
        vehicleName,
      }).catch((emailError) => {
        console.error(
          `Failed to send vehicle approval email for vehicle ${vehicle._id}:`,
          emailError && emailError.message ? emailError.message : emailError,
        );
      });
    }

    res.json({ ok: true, vehicle });
  } catch (e) { next(e); }
}

// Reject a vehicle listing and remove it from pending queue
async function rejectVehicle(req, res, next) {
  try {
    const id = req.params.id;
    const { reason } = req.body;
    const vehicle = await Vehicle.findById(id).populate('owner', 'name email');
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    vehicle.isVerified = false;
    vehicle.status = 'suspended';
    await vehicle.save();

    if (vehicle.owner?.email) {
      const vehicleName = [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Vehicle Listing';

      sendVehicleReviewEmail(vehicle.owner.email, {
        userName: vehicle.owner.name || 'User',
        status: 'rejected',
        reason,
        vehicleName,
      }).catch((emailError) => {
        console.error(
          `Failed to send vehicle rejection email for vehicle ${vehicle._id}:`,
          emailError && emailError.message ? emailError.message : emailError,
        );
      });
    }

    res.json({ ok: true, vehicle, message: 'Vehicle listing rejected' });
  } catch (e) { next(e); }
}

// Create a dispute (only renter or owner can create)
async function createDispute(req, res, next) {
  try {
    const reporterId = req.user && (req.user._id || req.user.sub);
    const reporterRole = req.user && req.user.role;
    const { bookingId, reason, description, incidentAt } = req.body;
    if (!reporterId) return res.status(401).json({ message: 'Authentication required' });
    if (!bookingId) return res.status(400).json({ message: 'bookingId required' });
    if (!reason || !String(reason).trim()) return res.status(400).json({ message: 'reason required' });
    if (!description || !String(description).trim()) return res.status(400).json({ message: 'description required' });

    if (!['renter', 'owner'].includes(String(reporterRole))) {
      return res.status(403).json({ message: 'Only renter or owner can create disputes' });
    }

    const booking = await Booking.findById(bookingId).select('renter owner status startDate endDate completedAt updatedAt').lean();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const isParticipant = [String(booking.renter), String(booking.owner)].includes(String(reporterId));
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not allowed to create dispute for this booking' });
    }

    const disputeAccess = getDisputeAccess(booking);
    if (!disputeAccess.allowed) {
      return res.status(400).json({
        message: disputeAccess.message,
        disputeAccess,
      });
    }

    if (disputeAccess.mode === 'dispute') {
      const existingCompletedBookingDispute = await Dispute.findOne({ bookingId })
        .select('_id reporterId status')
        .lean();

      if (existingCompletedBookingDispute) {
        return res.status(409).json({
          message: 'A dispute has already been created for this completed booking',
        });
      }
    }

    const existingOpenDispute = await Dispute.findOne({
      bookingId,
      status: { $in: ACTIVE_DISPUTE_STATUSES },
    }).lean();

    if (existingOpenDispute) {
      return res.status(409).json({ message: 'An active dispute already exists for this booking' });
    }

    const reporter = await User.findById(reporterId).select('name').lean();
    const evidence = Array.isArray(req.files)
      ? req.files
          .map((file) => ({
            url: file.path || file.secure_url || null,
            public_id: file.filename || file.public_id || null,
            originalName: file.originalname || null,
          }))
          .filter((file) => file.url)
      : [];

    const parsedIncidentAt = parseIncidentAt(incidentAt);
    const openedMessageParts = [
      `Dispute opened: ${String(reason).trim()}`,
      parsedIncidentAt ? `Incident time: ${parsedIncidentAt.toISOString()}` : null,
      String(description).trim(),
    ].filter(Boolean);

    const dispute = await Dispute.create({
      bookingId,
      reporterId,
      reason: String(reason).trim(),
      description: String(description).trim(),
      incidentAt: parsedIncidentAt,
      evidence,
      status: 'open',
      timeline: [{
        type: 'opened',
        message: openedMessageParts.join('\n\n'),
        actorId: reporterId,
        actorName: reporter && reporter.name,
        at: new Date(),
        evidences: evidence.map((file) => file.url),
      }],
    });

    const [renterUser, ownerUser, vehicleInfo] = await Promise.all([
      User.findById(booking.renter).select('name email').lean(),
      User.findById(booking.owner).select('name email').lean(),
      Booking.findById(bookingId)
        .populate('vehicle', 'brand model')
        .select('vehicle')
        .lean(),
    ]);

    const vehicleName = [vehicleInfo?.vehicle?.brand, vehicleInfo?.vehicle?.model].filter(Boolean).join(' ') || 'Booked Vehicle';
    const disputeId = `DIS-${String(dispute._id).slice(-6).toUpperCase()}`;
    const recipients = [renterUser, ownerUser].filter((participant) => participant?.email);

    await Promise.allSettled(
      recipients.map((participant) =>
        sendDisputeNotificationEmail(participant.email, {
          userName: participant.name || 'User',
          status: 'opened',
          reason: String(reason).trim(),
          bookingId: String(bookingId),
          disputeId,
          vehicleName,
        }),
      ),
    );

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
      evidences: event.evidences || [],
    }));

    res.json({ ok: true, dispute: normalized, timeline });
  } catch (e) { next(e); }
}

async function getDisputeByBooking(req, res, next) {
  try {
    const { bookingId } = req.params;
    const authUserId = req.user && (req.user._id || req.user.sub);
    const role = req.user && req.user.role;

    const dispute = await Dispute.findOne({ bookingId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'bookingId',
        select: 'startDate endDate totalPrice status renter owner vehicle payment completedAt updatedAt',
        populate: [
          { path: 'renter', select: 'name email phone image role' },
          { path: 'owner', select: 'name email phone image role' },
          { path: 'vehicle', select: 'brand model registrationNumber type photos status' },
        ],
      })
      .populate('reporterId', 'name email phone role')
      .populate('resolverId', 'name email phone role')
      .lean();

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found for this booking' });
    }

    const booking = dispute.bookingId;
    const isParticipant = booking && [String(booking.renter?._id || booking.renter), String(booking.owner?._id || booking.owner)].includes(String(authUserId));
    if (role !== 'admin' && !isParticipant) {
      return res.status(403).json({ message: 'Access forbidden' });
    }

    res.json({ ok: true, dispute: normalizeDispute(dispute) });
  } catch (e) { next(e); }
}

// Resolve a dispute (admin)
async function resolveDispute(req, res, next) {
  try {
    const id = req.params.id;
    const { resolution, action, status = 'resolved' } = req.body; // action could be 'refund','cancel','none'
    const resolverId = req.user && (req.user._id || req.user.sub);
    const dispute = await Dispute.findById(id).populate('bookingId', 'status renter owner vehicle');
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

    if (!DISPUTE_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${DISPUTE_STATUSES.join(', ')}` });
    }

    if (CLOSED_DISPUTE_STATUSES.includes(dispute.status)) {
      return res.status(409).json({ message: 'This dispute is already closed and can no longer be updated' });
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

    const recipients = [updated?.bookingId?.renter, updated?.bookingId?.owner].filter((participant) => participant?.email);
    const vehicleName = [updated?.bookingId?.vehicle?.brand, updated?.bookingId?.vehicle?.model].filter(Boolean).join(' ') || 'Booked Vehicle';
    const disputeId = `DIS-${String(updated._id).slice(-6).toUpperCase()}`;

    await Promise.allSettled(
      recipients.map((participant) =>
        sendDisputeNotificationEmail(participant.email, {
          userName: participant.name || 'User',
          status,
          resolution,
          reason: updated.reason,
          bookingId: String(updated.bookingId?._id || dispute.bookingId),
          disputeId,
          vehicleName,
        }),
      ),
    );

    res.json({ ok: true, dispute: normalizeDispute(updated) });
  } catch (e) { next(e); }
}

// Reject a user KYC submission
async function rejectUser(req, res, next) {
  try {
    const id = req.params.id;
    const { reason } = req.body;
    const user = await User.findOne({ _id: id, role: { $in: ['owner', 'renter'] } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isVerified = false;
    await user.save();

    if (user.email) {
      sendKycReviewEmail(user.email, {
        userName: user.name || 'User',
        status: 'rejected',
        reason,
        role: user.role,
      }).catch((emailError) => {
        console.error(
          `Failed to send KYC rejection email for user ${user._id}:`,
          emailError && emailError.message ? emailError.message : emailError,
        );
      });
    }

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
  getDisputeByBooking,
  resolveDispute,
};
