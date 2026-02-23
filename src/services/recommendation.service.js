const engine = require('../ai/recommendation.engine');

async function scoreRecommendations(query) {
  // Pass through to AI engine stub
  return engine.score(query || {});
}

module.exports = { scoreRecommendations };
