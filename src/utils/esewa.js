const crypto = require("crypto");

function generateSignature(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64");
}

module.exports = { generateSignature };