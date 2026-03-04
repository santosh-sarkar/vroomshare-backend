const Vehicle = require("../models/vehicle.model");
async function list(req, res, next) {
  try {
    const {
      owner,
      make,
      model,
      year,
      location,
      available,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sort,
    } = req.query;

    const query = {};
    if (owner) query.owner = owner;
    if (make) query.make = make;
    if (model) query.model = model;
    if (year) query.year = Number(year);
    if (location) query.location = location;
    if (available !== undefined) query.available = available === "true";
    if (minPrice || maxPrice) query.pricePerDay = {};
    if (minPrice) query.pricePerDay.$gte = Number(minPrice);
    if (maxPrice) query.pricePerDay.$lte = Number(maxPrice);

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
    const { owner, make, model, year, pricePerDay, location, available } =
      req.body;
    if (!owner || !make || !model || !year || !pricePerDay) {
      return res
        .status(400)
        .json({
          message: "owner, make, model, year and pricePerDay are required",
        });
    }

    const vehicle = await Vehicle.create({
      owner,
      make,
      model,
      year,
      pricePerDay,
      location,
      available,
    });
    res.status(201).json({ ok: true, vehicle });
  } catch (e) {
    next(e);
  }
}


async function get(req, res, next) {
  try {
    const vehicle = await Vehicle.findById(req.params.id).populate(
      "owner",
      "name email",
    );
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
    res.json({ ok: true, vehicle });
  } catch (e) {
    next(e);
  }
}
async function update(req, res, next) {
  try {
    const Vehicle = require('../models/vehicle.model');
    const allowed = ['make','model','year','pricePerDay','location','available'];
    const patch = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) patch[key] = req.body[key];
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    res.json({ ok: true, vehicle });
  } catch (e) { next(e); }
}

module.exports = { list, create, get, update };
