const Vehicle = require("../models/vehicle.model");
const Review = require("../models/review.model");
const Owner = require("../models/users/owner.model");
const mongoose = require("mongoose");

async function list(req, res, next) {
  try {
    const {
      ownerId,
      vehicleType,
      location,
      pickup,
      return: returnDate,
      priceMin,
      priceMax,
      availability,
      page = 1,
      limit = 10,
      sort,
    } = req.query;

    const query = {
      status: { $nin: ["pending", "archived", "suspended"] },
    };
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

    if (pickup && returnDate) {
      const requestedPickup = new Date(pickup);
      const requestedReturn = new Date(returnDate);

      if (
        Number.isNaN(requestedPickup.valueOf()) ||
        Number.isNaN(requestedReturn.valueOf())
      ) {
        return res.status(400).json({
          ok: false,
          message: "Invalid pickup or return date",
        });
      }

      if (requestedPickup >= requestedReturn) {
        return res.status(400).json({
          ok: false,
          message: "Pickup date must be before return date",
        });
      }

      query.blockedDates = {
        $not: {
          $elemMatch: {
            from: { $lt: requestedReturn },
            to: { $gt: requestedPickup },
          },
        },
      };
    }

    const skip = (Number(page) - 1) * Number(limit);

    let cursor = Vehicle.find(query).skip(skip).limit(Number(limit));
    if (sort) cursor = cursor.sort(sort);

    const [vehicles, total] = await Promise.all([
      cursor.exec(),
      Vehicle.countDocuments(query),
    ]);

    // Attach aggregated rating & review count to each vehicle
    const vehicleIds = vehicles.map((v) => v._id);
    let ratingMap = {};
    if (vehicleIds.length > 0) {
      const ratingAgg = await Review.aggregate([
        { $match: { vehicleId: { $in: vehicleIds } } },
        {
          $group: {
            _id: "$vehicleId",
            averageRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 },
          },
        },
        {
          $project: {
            averageRating: { $round: ["$averageRating", 1] },
            reviewCount: 1,
          },
        },
      ]);
      ratingMap = ratingAgg.reduce((map, r) => {
        map[r._id.toString()] = r;
        return map;
      }, {});
    }
    const vehiclesWithRatings = vehicles.map((v) => {
      const obj = v.toObject();
      const agg = ratingMap[obj._id.toString()];
      obj.averageRating = agg ? agg.averageRating : 0;
      obj.reviewCount = agg ? agg.reviewCount : 0;
      return obj;
    });

    res.json({
      ok: true,
      total,
      page: Number(page),
      limit: Number(limit),
      vehicles: vehiclesWithRatings,
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

    // Ensure owner has completed KYC verification
    const ownerDoc = await Owner.findById(owner).select("isVerified").lean();
    if (!ownerDoc?.isVerified)
      return res
        .status(403)
        .json({ ok: false, message: "KYC verification required before listing a vehicle." });

      
    // Extract fields from FormData
    let {
      vehicleType,
      brand,
      modelName,
      yearOfManufacture,
      engineCapacity,
      registrationNumber,
      fuelType,
      weight,
      transmission,
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
    const weightKg = weight ? Number(weight) : undefined;
    if (
      !vehicleType ||
      !brand ||
      !modelName ||
      !fuelType ||
      !description ||
      isNaN(dailyRate)
    )
      return res
        .status(400)
        .json({ ok: false, message: "Required fields missing or invalid" });
    const allowedTypes = ["motorcycle", "scooter", "electric"];
    const allowedFuelTypes = ["petrol", "electric"];
    const normalizedType = vehicleType.toString().trim().toLowerCase();
    const normalizedFuelType = fuelType.toString().trim().toLowerCase();
    if (!allowedTypes.includes(normalizedType))
      return res.status(400).json({
        ok: false,
        message: `Invalid vehicle type. Allowed: ${allowedTypes.join(", ")}`,
      });
    if (!allowedFuelTypes.includes(normalizedFuelType))
      return res.status(400).json({
        ok: false,
        message: `Invalid fuel type. Allowed: ${allowedFuelTypes.join(", ")}`,
      });
    const allowedTransmissions = ['manual', 'automatic', 'semi-automatic'];
    if (transmission && !allowedTransmissions.includes(transmission.toString().trim().toLowerCase()))
      return res.status(400).json({
        ok: false,
        message: `Invalid transmission. Allowed: ${allowedTransmissions.join(", ")}`,
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
      fuelType: normalizedFuelType,
      weight: weightKg,
      transmission: transmission ? transmission.toString().trim().toLowerCase() : undefined,
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
      "title", "description", "vehicleType", "type", "location",
      "pricePerDay", "pricing", "images", "availability", "isVerified",
      "brand", "model", "modelName", "year", "yearOfManufacture",
      "engineCc", "engineCapacity", "registrationNumber", "fuelType",
      "weight", "transmission", "features", "documents", "status",
      "dailyRate", "pickupLocation",
    ];
    const patch = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key))
        patch[key] = req.body[key];
    }

    // ── field name aliases ────────────────────────────────────────────────
    // modelName → model
    if (patch.modelName !== undefined) { patch.model = patch.modelName; delete patch.modelName; }
    // yearOfManufacture → year
    if (patch.yearOfManufacture !== undefined) { patch.year = Number(patch.yearOfManufacture); delete patch.yearOfManufacture; }
    // engineCapacity → engineCc
    if (patch.engineCapacity !== undefined) { patch.engineCc = Number(patch.engineCapacity); delete patch.engineCapacity; }
    // weight / engineCc: ensure numeric
    if (patch.weight !== undefined) patch.weight = Number(patch.weight);
    if (patch.engineCc !== undefined) patch.engineCc = Number(patch.engineCc);
    // dailyRate → pricing.dailyRate
    if (patch.dailyRate !== undefined) {
      patch.pricing = { dailyRate: Number(patch.dailyRate) };
      delete patch.dailyRate;
    }
    // pickupLocation → pickup (may be JSON string from FormData)
    if (patch.pickupLocation !== undefined) {
      try {
        const loc = typeof patch.pickupLocation === 'string'
          ? JSON.parse(patch.pickupLocation)
          : patch.pickupLocation;
        patch.pickup = {
          neighborhood: loc.city || loc.neighborhood || '',
          address:      loc.city || loc.address || '',
          coordinates:  [
            Number(loc.coordinates?.lng ?? 0),
            Number(loc.coordinates?.lat ?? 0),
          ],
        };
      } catch (_) { /* ignore parse error, skip pickup update */ }
      delete patch.pickupLocation;
    }
    // features: may arrive as JSON string from FormData
    if (patch.features !== undefined && typeof patch.features === 'string') {
      try { patch.features = JSON.parse(patch.features); } catch (_) { delete patch.features; }
    }

    // ── vehicleType → type ────────────────────────────────────────────────
    const allowedTypes = ["motorcycle", "scooter", "electric"];
    if (patch.vehicleType !== undefined || patch.type !== undefined) {
      const incoming = patch.vehicleType ?? patch.type;
      const normalized = incoming ? incoming.toString().trim().toLowerCase() : "";
      if (!allowedTypes.includes(normalized)) {
        return res.status(400).json({ message: `Invalid vehicle type. Allowed: ${allowedTypes.join(", ")}` });
      }
      patch.type = normalized;
      delete patch.vehicleType;
    }

    // ── status ────────────────────────────────────────────────────────────
    const allowedStatuses = ["pending", "active", "on-trip", "suspended", "archived"];
    if (patch.status !== undefined) {
      const normalizedStatus = patch.status ? patch.status.toString().trim().toLowerCase() : "";
      if (!allowedStatuses.includes(normalizedStatus)) {
        return res.status(400).json({ message: `Invalid vehicle status. Allowed: ${allowedStatuses.join(", ")}` });
      }
      patch.status = normalizedStatus;
    }

    const hasFiles = req.files && (
      (req.files.vehicleImages && req.files.vehicleImages.length > 0) ||
      (req.files.documentImages && req.files.documentImages.length > 0)
    );

    if (Object.keys(patch).length === 0 && !hasFiles) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

    const authUserId = req.user && (req.user._id || req.user.sub);
    if (authUserId && vehicle.owner && vehicle.owner.toString() !== authUserId.toString()) {
      return res.status(403).json({ message: "Not authorized to update this vehicle" });
    }

    Object.assign(vehicle, patch);

    // ── handle uploaded photos ────────────────────────────────────────────
    if (hasFiles) {
      if (req.files.vehicleImages && req.files.vehicleImages.length > 0) {
        const newUrls = req.files.vehicleImages.map((f) => f.path || f.secure_url);
        // If existingPhotos slot map is provided, rebuild the array in-place.
        // existingPhotos is a JSON array [url|null, ...]; null means this slot
        // is replaced by the next entry in newUrls.
        if (req.body.existingPhotos) {
          try {
            const slotMap = JSON.parse(req.body.existingPhotos); // [url|null, ...]
            let uploadIdx = 0;
            const rebuilt = slotMap.map((existing) => {
              if (existing === null) return newUrls[uploadIdx++] ?? null;
              return existing;
            });
            // Drop trailing nulls and append any overflow uploads
            const trimmed = rebuilt.filter(Boolean);
            while (uploadIdx < newUrls.length) trimmed.push(newUrls[uploadIdx++]);
            vehicle.photos = trimmed;
          } catch (_) {
            // Fallback: just append if parse fails
            if (!Array.isArray(vehicle.photos)) vehicle.photos = [];
            vehicle.photos.push(...newUrls);
          }
        } else {
          // No slot map — append (legacy behaviour)
          if (!Array.isArray(vehicle.photos)) vehicle.photos = [];
          vehicle.photos.push(...newUrls);
        }
      }
      if (req.files.documentImages && req.files.documentImages.length > 0) {
        req.files.documentImages.forEach((f) => {
          if (!Array.isArray(vehicle.documents)) vehicle.documents = [];
          vehicle.documents.push({ url: f.path || f.secure_url, verified: false });
        });
      }
    }

    await vehicle.save();
    res.json({ ok: true, vehicle });
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
      vehicle.owner &&
      vehicle.owner.toString() !== authUserId.toString()
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
