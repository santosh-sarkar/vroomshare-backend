const mongoose = require('mongoose');
const Booking = require('../models/booking.model');

async function getEarnings(ownerId) {
  if (!ownerId) throw new Error('ownerId required');

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

  // Aggregate total revenue and monthly revenue for last few months
  const monthly = await Booking.aggregate([
    { $match: { ownerId: ownerObjectId, paymentStatus: 'paid' } },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, revenue: { $sum: '$totalPrice' }, bookings: { $sum: 1 } } },
    { $sort: { _id: -1 } },
    { $limit: 6 }
  ]);

  const totalAgg = await Booking.aggregate([
    { $match: { ownerId: ownerObjectId, paymentStatus: 'paid' } },
    { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' }, totalBookings: { $sum: 1 } } }
  ]);

  const totals = totalAgg && totalAgg[0] ? totalAgg[0] : { totalRevenue: 0, totalBookings: 0 };

  return {
    totalRevenue: totals.totalRevenue || 0,
    totalBookings: totals.totalBookings || 0,
    monthlyRevenue: monthly.map(m => ({ month: m._id, revenue: m.revenue, bookings: m.bookings }))
  };
}

module.exports = { getEarnings };
