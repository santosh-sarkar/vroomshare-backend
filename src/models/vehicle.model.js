const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const VehicleSchema = new Schema({
  // Reference to user who owns this vehicle
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  // Listing status
  status: { type: String, enum: ['draft', 'pending', 'active', 'suspended', 'archived'], default: 'draft' },

  // Basic vehicle information
  type: { type: String, enum: ['motorcycle', 'scooter', 'electric'], required: true },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number },

  // Vehicle description and features
  description: { type: String, required: true },
  features: { type: [String], default: [] },

  // Engine and registration
  engineCc: { type: Number },
  registrationNumber: { type: String },

  // Photos: simple list of URLs
  photos: { type: [String], default: [] },

  // Documents: small objects with url and verification flag
  documents: [{
    type: { type: String, enum: ['bluebook', 'insurance', 'other'], default: 'other' },
    url: { type: String, required: true },
    verified: { type: Boolean, default: false }
  }],

  // Pickup location and coordinates [lng, lat]
  pickup: {
    neighborhood: { type: String },
    address: { type: String },
    coordinates: { type: [Number], default: [0, 0] }
  },

  // Pricing information
  pricing: {
    dailyRate: { type: Number, required: true },
    securityDeposit: { type: Number }
  },

  // Discounts array
  discounts: [{ minDays: Number, percent: Number }],

  // Dates when vehicle is not available
  blockedDates: [{ from: Date, to: Date }],

  // Verification flag
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

// Useful indexes
VehicleSchema.index({ owner: 1 });
VehicleSchema.index({ 'pickup.coordinates': '2dsphere' });

module.exports = model('Vehicle', VehicleSchema);
