async function list(req, res, next) {
  try {
    res.json({ ok: true, users: [] });
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    res.json({ ok: true, user: { id: req.params.id } });
  } catch (err) { next(err); }
}

module.exports = { list, get };
