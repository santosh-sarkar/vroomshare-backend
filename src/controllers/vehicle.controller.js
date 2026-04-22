const Vehicle = require("../models/vehicle.model");
const Review = require("../models/review.model");
const mongoose = require("mongoose");

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
      limit = 10,
      sort,
    } = req.query;

    const query = {};
    if (ownerId) query.ownerId = ownerId;
    if (vehicleType) query.vehicleType = vehicleType;
    if (location) {
      query["pickup.neighborhood"] = {
        $regex: location.trim(),
        $options: "i",
      };
    }
    if (availability !== undefined)
      query.availability = availability === "true";
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

    res.json({
      ok: true,
      total,
      page: Number(page),
      limit: Number(limit),
      vehicles,
    });
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    // Get owner ID from auth or request body
    const authUserId = req.user && (req.user._id || req.user.sub);
    const owner = authUserId || req.body.ownerId || req.body.owner;
    if (!owner || !mongoose.Types.ObjectId.isValid(owner))
      return res
        .status(400)
        .json({ ok: false, message: "Invalid or missing owner ID" });

    // Extract fields from FormData
    let {
      vehicleType,
      brand,
      modelName,
      yearOfManufacture,
      engineCapacity,
      registrationNumber,
      pickupLocation,
      dailyRate,
      description,
      features,
    } = req.body;

    // Parse JSON fields safely
    let pickup = {};
    if (pickupLocation) {
      try {
        pickup = JSON.parse(pickupLocation);
      } catch {
        return res
          .status(400)
          .json({ ok: false, message: "Invalid pickupLocation JSON" });
      }
    }

    // Parse features if sent as JSON string
    if (typeof features === "string") {
      try {
        features = JSON.parse(features);
      } catch {
        features = [features];
      }
    }

    // Convert types and validate numeric fields
    dailyRate = Number(dailyRate);
    const year = yearOfManufacture ? Number(yearOfManufacture) : undefined;
    const engineCc = engineCapacity ? Number(engineCapacity) : undefined;
    if (
      !vehicleType ||
      !brand ||
      !modelName ||
      !description ||
      isNaN(dailyRate)
    )
      return res
        .status(400)
        .json({ ok: false, message: "Required fields missing or invalid" });
    const allowedTypes = ["motorcycle", "scooter", "electric"];
    const normalizedType = vehicleType.toString().trim().toLowerCase();
    if (!allowedTypes.includes(normalizedType))
      return res.status(400).json({
        ok: false,
        message: `Invalid vehicle type. Allowed: ${allowedTypes.join(", ")}`,
      });
    if (yearOfManufacture && isNaN(year))
      return res
        .status(400)
        .json({ ok: false, message: "Invalid yearOfManufacture" });
    if (engineCapacity && isNaN(engineCc))
      return res
        .status(400)
        .json({ ok: false, message: "Invalid engineCapacity" });

    // Handle file uploads safely
    const photos = [];
    const documents = [];
    if (req.files) {
      const vehicleImages = Array.isArray(req.files.vehicleImages)
        ? req.files.vehicleImages
        : req.files.vehicleImages
          ? [req.files.vehicleImages]
          : [];
      vehicleImages.forEach((file) => {
        if (file.path) photos.push(file.path);
      });
      const documentImages = Array.isArray(req.files.documentImages)
        ? req.files.documentImages
        : req.files.documentImages
          ? [req.files.documentImages]
          : [];
      documentImages.forEach((file) => {
        if (file.path)
          documents.push({ type: "other", url: file.path, verified: false });
      });
    }

    // Construct new vehicle object
    const newVehicle = {
      owner,
      type: normalizedType,
      brand,
      model: modelName,
      year,
      engineCc,
      registrationNumber,
      description,
      features: features || [],
      pickup: {
        neighborhood: pickup.city || "",
        address: pickup.ward || "",
        coordinates: [
          pickup.coordinates?.lng || 0,
          pickup.coordinates?.lat || 0,
        ],
      },
      pricing: { dailyRate },
      photos,
      documents,
      status: "pending",
    };

    // Save vehicle to database
    const vehicle = await Vehicle.create(newVehicle);

    // Send success response
    res.status(201).json({ ok: true, vehicle });
  } catch (error) {
    // Handle unexpected errors
    next(error);
  }
}

module.exports = { create };

async function get(req, res, next) {
  try {
    const vehicle = await Vehicle.findById(req.params.id).populate(
      "owner",
      "name email",
    );
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    const reviews = await Review.find({ vehicleId: vehicle._id }).sort({
      createdAt: -1,
    });

    res.json({ ok: true, vehicle, totalReviews: reviews.length, reviews });
  } catch (e) {
    next(e);
  }
}
async function update(req, res, next) {
  try {
    const allowed = [
      "title",
      "description",
      "vehicleType",
      "type",
      "location",
      "pricePerDay",
      "pricing",
      "images",
      "availability",
      "isVerified",
      "brand",
      "model",
      "year",
      "engineCc",
      "registrationNumber",
      "documents",
    ];
    const patch = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key))
        patch[key] = req.body[key];
    }

    // map vehicleType -> type and normalize
    const allowedTypes = ["motorcycle", "scooter", "electric"];
    if (
      Object.prototype.hasOwnProperty.call(req.body, "vehicleType") ||
      Object.prototype.hasOwnProperty.call(req.body, "type")
    ) {
      const incoming = Object.prototype.hasOwnProperty.call(
        req.body,
        "vehicleType",
      )
        ? req.body.vehicleType
        : req.body.type;
      const normalized = incoming
        ? incoming.toString().trim().toLowerCase()
        : "";
      if (!allowedTypes.includes(normalized)) {
        return res.status(400).json({
          message: `Invalid vehicle type. Allowed: ${allowedTypes.join(", ")}`,
        });
      }
      patch.type = normalized;
      // remove vehicleType if present to avoid confusion
      delete patch.vehicleType;
    }

    if (Object.keys(patch).length === 0 && !req.file && !req.files) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    const authUserId = req.user && (req.user._id || req.user.sub);
    if (
      authUserId &&
      vehicle.ownerId &&
      vehicle.ownerId.toString() !== authUserId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this vehicle" });
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
    if (req.file)
      resp.upload = {
        url: req.file.path || req.file.secure_url,
        public_id: req.file.filename || req.file.public_id,
      };
    res.json(resp);
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    // If authenticated user present, ensure they are owner (simple check)
    const authUserId = req.user && (req.user._id || req.user.sub);
    if (
      authUserId &&
      vehicle.ownerId &&
      vehicle.ownerId.toString() !== authUserId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this vehicle" });
    }

    await Vehicle.findByIdAndDelete(req.params.id);
    res.json({ ok: true, message: "Vehicle deleted" });
  } catch (e) {
    next(e);
  }
}

async function ownerVehicles(req, res, next) {
  try {
    const authUserId = req.user && (req.user._id || req.user.sub);
    const ownerId = authUserId || req.query.ownerId;
    if (!ownerId)
      return res.status(400).json({ message: "ownerId is required" });
    const vehicles = await Vehicle.find({ owner: ownerId }).sort({
      createdAt: -1,
    });
    res.json({ ok: true, total: vehicles.length, vehicles });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, create, get, update, remove, ownerVehicles };
