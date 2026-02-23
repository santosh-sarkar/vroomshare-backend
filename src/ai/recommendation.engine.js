// Simple stub for recommendation scoring
async function score(params) {
  // Return static example recommendations — replace with AI logic later
  return [
    { vehicleId: 'v1', score: 0.9 },
    { vehicleId: 'v2', score: 0.7 }
  ];
}

module.exports = { score };
