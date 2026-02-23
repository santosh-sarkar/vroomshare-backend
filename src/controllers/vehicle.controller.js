async function list(req, res, next) {
  try { res.json({ ok: true, vehicles: [] }); } catch (e) { next(e); }
}
async function create(req, res, next) {
  try { res.status(201).json({ ok: true, vehicle: req.body }); } catch (e) { next(e); }
}
async function get(req, res, next) {
  try { res.json({ ok: true, vehicle: { id: req.params.id } }); } catch (e) { next(e); }
}

module.exports = { list, create, get };
