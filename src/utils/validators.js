function requireBody(fields = []) {
  return (req, res, next) => {
    for (const f of fields) if (req.body[f] == null) return res.status(400).json({ ok: false, msg: `Missing ${f}` });
    next();
  };
}

module.exports = { requireBody };
