const mongoose = require("mongoose");
const { getUserModel } = require("../services/auth.service");

async function getProfile(req, res, next) {
  try {
    const { sub, role } = req.user || {};
    console.log(sub);
    // Get user model
    const UserModel = getUserModel(role);
    if (!UserModel) {
      throw new Error("Invalid role");
    }
    
    res.json({ ok: true, user: [] });
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
    const { name, dob, phone, citizenshipNo, licenseNumber } = req.body || {};

    // ADDRESS: support either a JSON `address` field or bracketed fields from form-data
    let address = {};
    if (req.body && req.body.address) {
      try {
        address = typeof req.body.address === "string" ? JSON.parse(req.body.address) : req.body.address;
      } catch (e) {
        // fallback to empty object if parse fails
        address = {};
      }
    } else {
      address = {
        province: req.body["address[province]"] || req.body["address.province"] || undefined,
        district: req.body["address[district]"] || req.body["address.district"] || undefined,
        municipality: req.body["address[municipality]"] || req.body["address.municipality"] || undefined,
        wardNo: req.body["address[wardNo]"] || req.body["address.wardNo"] || undefined,
      };
    }

    // FILES: multer's fields() produces arrays per field name
    const files = req.files || {};
    const citizenshipFront = files?.citizenshipFrontPhoto?.[0] || null;
    const citizenshipBack = files?.citizenshipBackPhoto?.[0] || null;
    const licensePhoto = files?.licensePhoto?.[0] || null;
    const selfiePhoto = files?.selfiePhoto?.[0] || null;

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
      const profileUrl = pickUrl(selfiePhoto);
      if (cFrontUrl) images.citizenshipFront = cFrontUrl;
      if (cBackUrl) images.citizenshipBack = cBackUrl;
      if (profileUrl) images.profile = profileUrl;
      if (Object.keys(images).length) updateData.image = images;
    } else if (role === "renter") {
      if (citizenshipNo) updateData.citizenshipNo = String(citizenshipNo).trim();
      if (licenseNumber) updateData.licenseNumber = String(licenseNumber).trim();
      const images = {};
      const cFrontUrl = pickUrl(citizenshipFront);
      const cBackUrl = pickUrl(citizenshipBack);
      const licenseUrl = pickUrl(licensePhoto);
      const selfieUrl = pickUrl(selfiePhoto);
      if (cFrontUrl) images.citizenshipFrontPhoto = cFrontUrl;
      if (cBackUrl) images.citizenshipBackPhoto = cBackUrl;
      if (licenseUrl) images.licensePhoto = licenseUrl;
      if (selfieUrl) images.selfiePhoto = selfieUrl;
      if (Object.keys(images).length) updateData.image = images;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ ok: false, message: "No valid fields to update" });
    }

    // Perform update
    const updated = await UserModel.findByIdAndUpdate(sub, updateData, { new: true, runValidators: true }).select("-password -__v");
    if (!updated) return res.status(404).json({ ok: false, message: "User not found" });

    res.json({ ok: true, user: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile };
