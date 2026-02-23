const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  const example = path.resolve(process.cwd(), '.env.example');
  if (fs.existsSync(example)) dotenv.config({ path: example });
}

module.exports = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/vroomshare',
  jwtSecret: process.env.JWT_SECRET || 'supersecret'
};