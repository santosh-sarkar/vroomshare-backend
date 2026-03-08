const Vehicle = require("../models/vehicle.model");
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
    const ownerId = authUserId || req.body.ownerId || req.body.owner;
    const { title, description, vehicleType, location, pricePerDay, images, availability } = req.body;

    if (!ownerId || !title || !pricePerDay) {
      return res.status(400).json({ message: 'ownerId, title and pricePerDay are required' });
    }

    const vehicle = await Vehicle.create({
      ownerId,
      title,
      description,
      vehicleType,
      location,
      pricePerDay,
      images: images || [],
      availability: availability !== undefined ? availability : true,
    });
    res.status(201).json({ ok: true, vehicle });
  } catch (e) {
    next(e);
  }
}


async function get(req, res, next) {
  try {
    const vehicle = await Vehicle.findById(req.params.id).populate("ownerId", "name email");
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
    res.json({ ok: true, vehicle });
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
    await vehicle.save();
    res.json({ ok: true, vehicle });
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
