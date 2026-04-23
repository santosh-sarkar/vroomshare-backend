const Review = require('../models/review.model');
const Booking = require('../models/booking.model');

// Create a review (renter) — only after booking completed
async function create(req, res, next) {
  try {
    const renterId = req.user && (req.user._id || req.user.sub);
    const { vehicleId, bookingId, rating, comment } = req.body;

    if (!renterId) return res.status(401).json({ message: 'Authentication required' });
    if (!vehicleId || !bookingId || !rating) return res.status(400).json({ message: 'vehicleId, bookingId and rating are required' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.renter && booking.renter.toString() !== renterId.toString()) {
      return res.status(403).json({ message: 'Not authorized to review this booking' });
    }

    if (booking.status !== 'completed') return res.status(400).json({ message: 'Review allowed only after booking is completed' });

    const existing = await Review.findOne({ booking: bookingId });
    if (existing) return res.status(400).json({ message: 'Review already submitted for this booking' });

    const review = await Review.create({ vehicleId, booking: bookingId, renterId, rating, comment });
    res.status(201).json({ ok: true, review });
  } catch (e) {
    next(e);
  }
}

// Get reviews for a vehicle
async function getByVehicle(req, res, next) {
  try {
    const { vehicleId } = req.params;
    const reviews = await Review.find({ vehicleId })
      .populate('renterId', 'name image')
      .sort({ createdAt: -1 });
    res.json({ ok: true, total: reviews.length, reviews });
  } catch (e) {
    next(e);
  }
}

module.exports = { create, getByVehicle };
