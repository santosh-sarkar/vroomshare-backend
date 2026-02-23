function success(res, data) { res.json(Object.assign({ ok: true }, data)); }
function fail(res, status, msg) { res.status(status).json({ ok: false, msg }); }

module.exports = { success, fail };
