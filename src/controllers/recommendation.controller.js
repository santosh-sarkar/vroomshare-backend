const recommendationService = require('../services/recommendation.service');

//not built yet due to time constraints, but will be used to score recommendations based on user input( in future )
async function recommend(req, res, next) {
  try {
    const results = await recommendationService.scoreRecommendations(req.query);
    res.json({ ok: true, results });
  } catch (e) { next(e); }
}

module.exports = { recommend };
