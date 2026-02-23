async function stats(req, res, next) {
  try {
    res.json({ ok: true, stats: {} });
  } catch (e) {
    next(e);
  }
}

module.exports = { stats };
