const { port } = require('./config/env');
const db = require('./config/db');
const app = require('./app');

db.connect().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


