const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Vehicle = require('../models/vehicle.model');
const Review = require('../models/review.model');

const PLATFORM_FEE_RATE = 0.15;

async function getEarnings(ownerId) {
  if (!ownerId) throw new Error('ownerId required');

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const now = new Date();

  // Aggregate net owner earnings and monthly earnings for the last few months.
  // Use paidAt when available, otherwise fallback to createdAt.
  const monthly = await Booking.aggregate([
    { $match: { owner: ownerObjectId, 'payment.status': 'paid' } },
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
    { $match: { owner: ownerObjectId, 'payment.status': 'paid' } },
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

  const totals = totalAgg && totalAgg[0]
    ? totalAgg[0]
    : { totalRevenue: 0, grossRevenue: 0, platformFees: 0, totalBookings: 0 };

  return {
    totalRevenue: totals.totalRevenue || 0,
    grossRevenue: totals.grossRevenue || 0,
    platformFees: totals.platformFees || 0,
    totalBookings: totals.totalBookings || 0,
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

module.exports = { getEarnings };
