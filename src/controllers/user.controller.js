const mongoose = require("mongoose");
const path = require("path");
const { Worker } = require("worker_threads");
const { getUserModel } = require("../services/auth.service");
const Vehicle = require("../models/vehicle.model");

// Run KYC in a worker thread so it never blocks the Express event loop
function runKycWorker(userId) {
  const worker = new Worker(path.join(__dirname, '../ai/kyc.worker.js'), {
    workerData: { userId: String(userId) },
  });
  worker.on('message', (msg) => {
    if (!msg.ok) console.error(`[KYC] Worker error for ${userId}:`, msg.error);
    else console.log(`[KYC] Worker finished for ${userId}`);
  });
  worker.on('error', (err) => console.error(`[KYC] Worker threw for ${userId}:`, err.message));
}

async function getProfile(req, res, next) {
  try {
    const { sub, role } = req.user || {};
    if (!sub || !mongoose.Types.ObjectId.isValid(sub))
      return res
        .status(400)
        .json({ ok: false, message: "Invalid or missing user ID" });

    // Get user model
    const UserModel = getUserModel(role);
    if (!UserModel) {
      throw new Error("Invalid role");
    }

    const profile = await UserModel.findById(sub).select('-password -__v');
    if(!profile) return res.status(400).json({ok:false, message:"user not found!"})

    res.json({ ok: true, user:profile});
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { role, sub } = req.user || {};

    if (!sub || !mongoose.Types.ObjectId.isValid(sub))
      return res
        .status(400)
        .json({ ok: false, message: "Invalid or missing user ID" });

    // Get user model
    const UserModel = getUserModel(role);
    if (!UserModel) {
      throw new Error("Invalid role");
    }

    // Extract fields from FormData / body
    const { name, dob, phone, citizenshipNo, licenseNumber, gender } = req.body || {};

    // ADDRESS: support either a JSON `address` field or bracketed fields from form-data
    let address = {};
    if (req.body && req.body.address) {
      try {
        address =
          typeof req.body.address === "string"
            ? JSON.parse(req.body.address)
            : req.body.address;
      } catch (e) {
        // fallback to empty object if parse fails
        address = {};
      }
    } else {
      address = {
        province:
          req.body["address[province]"] ||
          req.body["address.province"] ||
          undefined,
        district:
          req.body["address[district]"] ||
          req.body["address.district"] ||
          undefined,
        municipality:
          req.body["address[municipality]"] ||
          req.body["address.municipality"] ||
          undefined,
        wardNo:
          req.body["address[wardNo]"] ||
          req.body["address.wardNo"] ||
          undefined,
      };
    }

    // FILES: multer's fields() produces arrays per field name
    const files = req.files || {};
    const citizenshipFront = files?.citizenshipFrontPhoto?.[0] || null;
    const citizenshipBack = files?.citizenshipBackPhoto?.[0] || null;
    const licensePhoto = files?.licensePhoto?.[0] || null;
    const selfieWithId = files?.selfieWithId?.[0] || null;

    // helper to pick cloudinary url
    const pickUrl = (file) => {
      if (!file) return null;
      return file.path || file.secure_url || file.url || file.location || null;
    };

    // Build update document with allowed fields only
    const updateData = {};
    if (name) updateData.name = String(name).trim();
    if (dob) {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) updateData.dob = d;
    }
    if (gender) updateData.gender = String(gender).trim().toLowerCase();
    if (phone) updateData.phone = String(phone).trim();
    // address: only include keys that are present
    const addrKeys = ["province", "district", "municipality", "wardNo"];
    const addrObj = {};
    for (const k of addrKeys) {
      if (address && address[k]) addrObj[k] = address[k];
    }
    if (Object.keys(addrObj).length) updateData.address = addrObj;

    // Role-specific mapping
    if (role === "owner") {
      const images = {};
      const cFrontUrl = pickUrl(citizenshipFront);
      const cBackUrl = pickUrl(citizenshipBack);
      const profileUrl = pickUrl(selfieWithId);
      if (cFrontUrl) images.citizenshipFront = cFrontUrl;
      if (cBackUrl) images.citizenshipBack = cBackUrl;
      if (profileUrl) { images.profile = profileUrl; images.selfieWithId = profileUrl; }
      if (Object.keys(images).length) updateData.image = images;
    } else if (role === "renter") {
      if (citizenshipNo)
        updateData.citizenshipNo = String(citizenshipNo).trim();
      if (licenseNumber)
        updateData.licenseNumber = String(licenseNumber).trim();
      const images = {};
      const cFrontUrl = pickUrl(citizenshipFront);
      const cBackUrl = pickUrl(citizenshipBack);
      const licenseUrl = pickUrl(licensePhoto);
      const selfieWithIdUrl = pickUrl(selfieWithId);
      if (cFrontUrl) images.citizenshipFrontPhoto = cFrontUrl;
      if (cBackUrl) images.citizenshipBackPhoto = cBackUrl;
      if (licenseUrl) images.licensePhoto = licenseUrl;
      if (selfieWithIdUrl) images.selfieWithId = selfieWithIdUrl;
      if (Object.keys(images).length) updateData.image = images;
    }

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "No valid fields to update" });
    }

    // Determine if KYC images are being re-uploaded in this request.
    const hasKycImagesInUpdate = Object.keys(files).some((k) =>
      ['citizenshipFrontPhoto', 'citizenshipBackPhoto', 'licensePhoto',
       'selfieWithId', 'citizenshipFront', 'citizenshipBack'].includes(k),
    );

    // Whenever KYC documents are re-uploaded, wipe all previous AI results so
    // the admin and frontend never see stale data from the old submission.
    if (hasKycImagesInUpdate) {
      updateData.isVerified = false;
      updateData['kycData.aiStatus']        = 'pending';
      updateData['kycData.faceMatchScore']  = null;
      updateData['kycData.faceMatchNote']   = null;
      updateData['kycData.finalScore']      = null;
      updateData['kycData.processedAt']     = null;
      updateData['kycData.ocrData']         = { citizenship: {}, license: {} };
    } else if (updateData.citizenshipNo || updateData.licenseNumber) {
      // Security: ID numbers changed without new images → also revoke verification.
      const currentUser = await UserModel.findById(sub).select('isVerified').lean();
      if (currentUser?.isVerified) {
        updateData.isVerified = false;
        updateData['kycData.aiStatus'] = 'pending';
      }
    }

    // Perform update
    const updated = await UserModel.findByIdAndUpdate(sub, updateData, {
      new: true,
      runValidators: true,
    }).select("-password -__v");
    if (!updated)
      return res.status(404).json({ ok: false, message: "User not found" });

    // If KYC documents were uploaded in this request, kick off background analysis.
    // We check whether any image field was part of the update to avoid redundant runs.
    if (hasKycImagesInUpdate) {
      // Fire-and-forget in a Worker Thread – never blocks the HTTP event loop
      runKycWorker(sub);
    }

    res.json({ ok: true, user: updated });
  } catch (err) {
    next(err);
  }
}

async function getFavorites(req, res, next) {
  try {
    const { sub, role } = req.user || {};
    if (!sub || !mongoose.Types.ObjectId.isValid(sub)) {
      return res.status(400).json({ ok: false, message: "Invalid or missing user ID" });
    }

    if (role !== "renter") {
      return res.status(403).json({ ok: false, message: "Only renters can access favorites" });
    }

    const UserModel = getUserModel(role, true);
    const user = await UserModel.findById(sub)
      .select("favorites")
      .populate({
        path: "favorites",
        populate: { path: "owner", select: "name email" },
      })
      .lean();

    if (!user) return res.status(404).json({ ok: false, message: "User not found" });

    res.json({ ok: true, total: (user.favorites || []).length, favorites: user.favorites || [] });
  } catch (err) {
    next(err);
  }
}

async function addFavorite(req, res, next) {
  try {
    const { sub, role } = req.user || {};
    const { vehicleId } = req.params;

    if (!sub || !mongoose.Types.ObjectId.isValid(sub)) {
      return res.status(400).json({ ok: false, message: "Invalid or missing user ID" });
    }
    if (role !== "renter") {
      return res.status(403).json({ ok: false, message: "Only renters can add favorites" });
    }
    if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ ok: false, message: "Invalid vehicleId" });
    }

    const vehicle = await Vehicle.findById(vehicleId).select("_id").lean();
    if (!vehicle) return res.status(404).json({ ok: false, message: "Vehicle not found" });

    const UserModel = getUserModel(role, true);
    const updated = await UserModel.findByIdAndUpdate(
      sub,
      { $addToSet: { favorites: vehicleId } },
      { new: true }
    ).select("favorites");

    if (!updated) return res.status(404).json({ ok: false, message: "User not found" });

    res.json({ ok: true, message: "Added to favorites", total: (updated.favorites || []).length, favorites: updated.favorites || [] });
  } catch (err) {
    next(err);
  }
}

async function removeFavorite(req, res, next) {
  try {
    const { sub, role } = req.user || {};
    const { vehicleId } = req.params;

    if (!sub || !mongoose.Types.ObjectId.isValid(sub)) {
      return res.status(400).json({ ok: false, message: "Invalid or missing user ID" });
    }
    if (role !== "renter") {
      return res.status(403).json({ ok: false, message: "Only renters can remove favorites" });
    }
    if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ ok: false, message: "Invalid vehicleId" });
    }

    const UserModel = getUserModel(role, true);
    const updated = await UserModel.findByIdAndUpdate(
      sub,
      { $pull: { favorites: vehicleId } },
      { new: true }
    ).select("favorites");

    if (!updated) return res.status(404).json({ ok: false, message: "User not found" });

    res.json({ ok: true, message: "Removed from favorites", total: (updated.favorites || []).length, favorites: updated.favorites || [] });
  } catch (err) {
    next(err);
  }
}

async function updateProfilePhoto(req, res, next) {
  try {
    const { sub, role } = req.user || {};
    if (!sub || !mongoose.Types.ObjectId.isValid(sub))
      return res.status(400).json({ ok: false, message: "Invalid or missing user ID" });

    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, message: "No image file provided" });

    const url = file.path || file.secure_url || file.url || file.location || null;
    if (!url) return res.status(500).json({ ok: false, message: "Upload failed: no URL returned" });

    const UserModel = getUserModel(role);
    const updated = await UserModel.findByIdAndUpdate(
      sub,
      { "image.profile": url },
      { new: true, runValidators: false }
    ).select("-password -__v");

    if (!updated) return res.status(404).json({ ok: false, message: "User not found" });

    res.json({ ok: true, user: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, updateProfilePhoto, getFavorites, addFavorite, removeFavorite };
