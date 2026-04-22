const User = require('../models/users/user.model');
const Vehicle = require('../models/vehicle.model');
const Booking = require('../models/booking.model');
const Dispute = require('../models/dispute.model');

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

// Create a dispute (any user/admin can create)
async function createDispute(req, res, next) {
  try {
    const reporterId = req.user && (req.user._id || req.user.sub);
    const { bookingId, reason } = req.body;
    if (!reporterId) return res.status(401).json({ message: 'Authentication required' });
    if (!bookingId) return res.status(400).json({ message: 'bookingId required' });

    const dispute = await Dispute.create({ bookingId, reporterId, reason, status: 'open' });
    res.status(201).json({ ok: true, dispute });
  } catch (e) { next(e); }
}

// Resolve a dispute (admin)
async function resolveDispute(req, res, next) {
  try {
    const id = req.params.id;
    const { resolution, action } = req.body; // action could be 'refund','cancel','none'
    const resolverId = req.user && (req.user._id || req.user.sub);
    const dispute = await Dispute.findById(id);
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

    dispute.resolverId = resolverId;
    dispute.resolution = resolution;
    dispute.status = 'resolved';
    await dispute.save();

    // optional actions on booking
    if (action === 'cancel') {
      await Booking.findByIdAndUpdate(dispute.bookingId, { status: 'cancelled' });
    }

    res.json({ ok: true, dispute });
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

module.exports = { stats, verifyUser, rejectUser, getPendingUsers, getPendingUserById, verifyVehicle, rejectVehicle, getPendingVehicles, createDispute, resolveDispute };
