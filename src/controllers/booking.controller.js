async function create(req, res, next) {
  try {
    res.status(201).json({ ok: true, booking: req.body });
  } catch (e) {
    next(e);
  }
}
async function get(req, res, next) {
  try {
    res.json({ ok: true, booking: { id: req.params.id } });
  } catch (e) {
    next(e);
  }
}

module.exports = { create, get };
