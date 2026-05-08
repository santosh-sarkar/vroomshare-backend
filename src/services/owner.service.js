const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Vehicle = require('../models/vehicle.model');
const Review = require('../models/review.model');
const User = require('../models/users/user.model');
const PayoutRequest = require('../models/payoutRequest.model');

const PLATFORM_FEE_RATE = 0.15;

async function getEarnings(ownerId) {
  if (!ownerId) throw new Error('ownerId required');

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const now = new Date();

  // Aggregate net owner earnings and monthly earnings for the last few months.
  // Use paidAt when available, otherwise fallback to createdAt.
  const monthly = await Booking.aggregate([
    { $match: { owner: ownerObjectId, 'payment.status': 'paid', status: 'completed' } },
    {
      $project: {
        grossAmount: '$totalPrice',
        platformFee: { $multiply: ['$totalPrice', PLATFORM_FEE_RATE] },
        netAmount: { $multiply: ['$totalPrice', 1 - PLATFORM_FEE_RATE] },
        paidOrCreatedAt: { $ifNull: ['$payment.paidAt', '$createdAt'] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m', date: '$paidOrCreatedAt' },
        },
        grossRevenue: { $sum: '$grossAmount' },
        platformFees: { $sum: '$platformFee' },
        revenue: { $sum: '$netAmount' },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 6 },
  ]);

  const totalAgg = await Booking.aggregate([
    { $match: { owner: ownerObjectId, 'payment.status': 'paid', status: 'completed' } },
    {
      $project: {
        grossAmount: '$totalPrice',
        platformFee: { $multiply: ['$totalPrice', PLATFORM_FEE_RATE] },
        netAmount: { $multiply: ['$totalPrice', 1 - PLATFORM_FEE_RATE] },
      },
    },
    {
      $group: {
        _id: null,
        grossRevenue: { $sum: '$grossAmount' },
        platformFees: { $sum: '$platformFee' },
        totalRevenue: { $sum: '$netAmount' },
        totalBookings: { $sum: 1 },
      },
    },
  ]);

  const activeBookings = await Booking.countDocuments({
    owner: ownerObjectId,
    status: { $in: ['approved', 'confirmed'] },
  });

  const activeRentals = await Booking.countDocuments({
    owner: ownerObjectId,
    status: 'confirmed',
    startDate: { $lte: now },
    endDate: { $gte: now },
  });

  const ownerVehicles = await Vehicle.find({ owner: ownerObjectId }).select('_id');
  const vehicleIds = ownerVehicles.map((vehicle) => vehicle._id);
  const totalFleet = vehicleIds.length;

  const ratingAgg = vehicleIds.length
    ? await Review.aggregate([
        { $match: { vehicleId: { $in: vehicleIds } } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ])
    : [];

  const [totalWithdrawal, totals] = await Promise.all([
    getTotalWithdrawalAmount(ownerObjectId),
    totalAgg && totalAgg[0]
      ? totalAgg[0]
      : { totalRevenue: 0, grossRevenue: 0, platformFees: 0, totalBookings: 0 },
  ]);

  const totalRevenue = Number(totals.totalRevenue || 0);

  return {
    totalRevenue,
    grossRevenue: totals.grossRevenue || 0,
    platformFees: totals.platformFees || 0,
    totalBookings: totals.totalBookings || 0,
    totalWithdrawal,
    activeBookings,
    activeRentals,
    totalFleet,
    avgRating: ratingAgg[0]?.avgRating || 0,
    totalReviews: ratingAgg[0]?.totalReviews || 0,
    monthlyRevenue: monthly.map((m) => ({
      month: m._id,
      revenue: m.revenue,
      grossRevenue: m.grossRevenue,
      platformFees: m.platformFees,
      bookings: m.bookings,
    })),
  };
}

async function getTotalWithdrawalAmount(ownerObjectId) {
  const paidAgg = await PayoutRequest.aggregate([
    {
      $match: {
        owner: ownerObjectId,
        status: 'paid',
      },
    },
    {
      $group: {
        _id: null,
        totalWithdrawal: { $sum: '$amount' },
      },
    },
  ]);

  return Number(paidAgg[0]?.totalWithdrawal || 0);
}

async function getReservedPayoutAmount(ownerObjectId) {
  const reservedAgg = await PayoutRequest.aggregate([
    {
      $match: {
        owner: ownerObjectId,
        status: { $in: ['pending', 'approved'] },
      },
    },
    {
      $group: {
        _id: null,
        totalReserved: { $sum: '$amount' },
      },
    },
  ]);

  return Number(reservedAgg[0]?.totalReserved || 0);
}

async function getPayoutSettings(ownerId) {
  if (!ownerId) throw new Error('ownerId required');

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const [earnings, user, reservedAmount, totalWithdrawal, recentRequests] = await Promise.all([
    getEarnings(ownerId),
    User.findById(ownerObjectId).select('payoutSettings'),
    getReservedPayoutAmount(ownerObjectId),
    getTotalWithdrawalAmount(ownerObjectId),
    PayoutRequest.find({ owner: ownerObjectId })
      .select('amount status paymentMethod createdAt payoutDetails')
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  const totalEarnings = Number(earnings.totalRevenue || 0);
  const availableBalance = Math.max(totalEarnings - totalWithdrawal - reservedAmount, 0);

  return {
    payoutSettings: {
      esewaId: user?.payoutSettings?.esewaId || '',
      accountName: user?.payoutSettings?.accountName || '',
    },
    totalEarnings,
    totalWithdrawal,
    reservedAmount,
    availableBalance,
    recentRequests,
  };
}


async function savePayoutSettings(ownerId, payload = {}) {
  if (!ownerId) throw new Error('ownerId required');

  const esewaId = String(payload.esewaId || '').trim();
  const accountName = String(payload.accountName || '').trim();

  if (!esewaId) {
    const err = new Error('eSewa ID is required');
    err.statusCode = 400;
    throw err;
  }

  if (!accountName) {
    const err = new Error('Account name is required');
    err.statusCode = 400;
    throw err;
  }

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const user = await User.findByIdAndUpdate(
    ownerObjectId,
    {
      $set: {
        payoutSettings: {
          esewaId,
          accountName,
        },
      },
    },
    { new: true, runValidators: true, select: 'payoutSettings' },
  );

  if (!user) {
    const err = new Error('Owner not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    esewaId: user.payoutSettings?.esewaId || '',
    accountName: user.payoutSettings?.accountName || '',
  };
}

async function requestPayout(ownerId, payload = {}) {
  if (!ownerId) throw new Error('ownerId required');

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const amount = Number(payload.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('Amount must be greater than 0');
    err.statusCode = 400;
    throw err;
  }

  const [earnings, user, reservedAmount] = await Promise.all([
    getEarnings(ownerId),
    User.findById(ownerObjectId).select('payoutSettings'),
    getReservedPayoutAmount(ownerObjectId),
  ]);

  const esewaId = user?.payoutSettings?.esewaId || '';
  const accountName = user?.payoutSettings?.accountName || '';

  if (!esewaId || !accountName) {
    const err = new Error('Please save your eSewa payout settings first');
    err.statusCode = 400;
    throw err;
  }

  const totalEarnings = Number(earnings.totalRevenue || 0);
  const totalWithdrawal = Number(earnings.totalWithdrawal || 0);
  const availableBalance = Math.max(totalEarnings - totalWithdrawal - reservedAmount, 0);

  if (amount > availableBalance) {
    const err = new Error('Requested amount cannot exceed available earnings');
    err.statusCode = 400;
    throw err;
  }

  const request = await PayoutRequest.create({
    owner: ownerObjectId,
    amount,
    paymentMethod: 'esewa',
    payoutDetails: { esewaId, accountName },
    status: 'pending',
  });

  return {
    request,
    availableBalance: Math.max(availableBalance - amount, 0),
  };
}

module.exports = { getEarnings, getPayoutSettings, savePayoutSettings, requestPayout };
