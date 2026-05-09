const http = require('http');
const { port } = require('./config/env');
const db = require('./config/db');
const app = require('./app');
const { attachSocketServer } = require('./socket');
const { startPaymentExpiryJob } = require('./jobs/paymentExpiry.job');

const allowedOrigins = [
  'http://localhost:3000',
  'https://vroomshare-frontend.vercel.app',
  'https://vroomshare.vercel.app',
];

const httpServer = http.createServer(app);
attachSocketServer(httpServer, allowedOrigins);

db.connect().then(() => {
  httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
  startPaymentExpiryJob();
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


