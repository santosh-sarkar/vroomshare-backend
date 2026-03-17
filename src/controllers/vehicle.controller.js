const Vehicle = require("../models/vehicle.model");
const Review = require("../models/review.model");
async function list(req, res, next) {
  try {
    const {
      ownerId,
      vehicleType,
      location,
      priceMin,
      priceMax,
      availability,
      page = 1,
      limit = 20,
      sort,
    } = req.query;

    const query = {};
    if (ownerId) query.ownerId = ownerId;
    if (vehicleType) query.vehicleType = vehicleType;
    if (location) query.location = location;
    if (availability !== undefined) query.availability = availability === "true";
    if (priceMin || priceMax) query.pricePerDay = {};
    if (priceMin) query.pricePerDay.$gte = Number(priceMin);
    if (priceMax) query.pricePerDay.$lte = Number(priceMax);

    const skip = (Number(page) - 1) * Number(limit);

    let cursor = Vehicle.find(query).skip(skip).limit(Number(limit));
    if (sort) cursor = cursor.sort(sort);

    const [vehicles, total] = await Promise.all([
      cursor.exec(),
      Vehicle.countDocuments(query),
    ]);

    res.json({ ok: true, total, page: Number(page), limit: Number(limit), vehicles });
  } catch (e) {
    next(e);
  }
}


async function create(req, res, next) {
  try {
    const authUserId = req.user && (req.user._id || req.user.sub);
    const owner = authUserId || req.body.ownerId || req.body.owner;
    // Accept fields matching the updated Vehicle model, but be forgiving to older names
    const {
      title,
      description,
      features,
      vehicleType,
      type,
      brand,
      model: modelName,
      year,
      engineCc,
      registrationNumber,
      location,
      pricing,
      images,
      availability,
    } = req.body;

    // minimal validation
    const dailyRate =  (pricing && pricing.dailyRate);

    if (!owner || !dailyRate) {
      return res.status(400).json({ message: 'owner and dailyRate (pricePerDay) are required' });
    }

    const newVehicle = {
      owner,
      title,
      description,
      features,
      status: 'draft',
      type: type || vehicleType,
      brand,
      model: modelName,
      year,
      engineCc,
      registrationNumber,
      pickup: location || {},
      pricing: pricing || { dailyRate: Number(dailyRate) },
      photos: Array.isArray(images) ? images : [],
      availability: availability !== undefined ? availability : true,
    };

    // If multer uploaded a file (via route middleware), attach its Cloudinary URL
    if (req.file) {
      // multer-storage-cloudinary exposes `path` and `filename`
      const url = req.file.path || (req.file.secure_url || null);
      const public_id = req.file.filename || req.file.public_id || null;
      if (url) newVehicle.photos.push(url);
      // save a reference to last uploaded image meta if desired
      if (public_id) newVehicle.lastImagePublicId = public_id;
    }

    const vehicle = await Vehicle.create(newVehicle);

    const resp = { ok: true, vehicle };
    if (req.file) {
      resp.upload = {
        url: req.file.path || req.file.secure_url,
        public_id: req.file.filename || req.file.public_id,
      };
    }

    res.status(201).json(resp);
  } catch (e) {
    next(e);
  }
}


async function get(req, res, next) {
  try {
    const vehicle = await Vehicle.findById(req.params.id).populate("ownerId", "name email");
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    const reviews = await Review.find({ vehicleId: vehicle._id }).sort({ createdAt: -1 });

    res.json({ ok: true, vehicle, totalReviews: reviews.length, reviews });
  } catch (e) {
    next(e);
  }
}
async function update(req, res, next) {
  try {
    const allowed = ['title','description','vehicleType','location','pricePerDay','images','availability','isVerified'];
    const patch = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) patch[key] = req.body[key];
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    const authUserId = req.user && (req.user._id || req.user.sub);
    if (authUserId && vehicle.ownerId && vehicle.ownerId.toString() !== authUserId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this vehicle' });
    }

    Object.assign(vehicle, patch);
    // If a new image was uploaded, add to photos array
    if (req.file) {
      const url = req.file.path || req.file.secure_url || null;
      const public_id = req.file.filename || req.file.public_id || null;
      if (url) {
        if (!Array.isArray(vehicle.photos)) vehicle.photos = [];
        vehicle.photos.push(url);
      }
      if (public_id) vehicle.lastImagePublicId = public_id;
    }
    await vehicle.save();
    const resp = { ok: true, vehicle };
    if (req.file) resp.upload = { url: req.file.path || req.file.secure_url, public_id: req.file.filename || req.file.public_id };
    res.json(resp);
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    // If authenticated user present, ensure they are owner (simple check)
    const authUserId = req.user && (req.user._id || req.user.sub);
    if (authUserId && vehicle.ownerId && vehicle.ownerId.toString() !== authUserId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this vehicle' });
    }

    await Vehicle.findByIdAndDelete(req.params.id);
    res.json({ ok: true, message: 'Vehicle deleted' });
  } catch (e) { next(e); }
}

async function ownerVehicles(req, res, next) {
  try {
    const authUserId = req.user && (req.user._id || req.user.sub);
    const ownerId = authUserId || req.query.ownerId;
    if (!ownerId) return res.status(400).json({ message: 'ownerId is required' });
    const vehicles = await Vehicle.find({ ownerId });
    res.json({ ok: true, total: vehicles.length, vehicles });
  } catch (e) { next(e); }
}

module.exports = { list, create, get, update , remove, ownerVehicles };
