const recommendationService = require('../services/recommendation.service');

async function recommend(req, res, next) {
  try {
    const results = await recommendationService.scoreRecommendations(req.query);
    res.json({ ok: true, results });
  } catch (e) { next(e); }
}

module.exports = { recommend };
