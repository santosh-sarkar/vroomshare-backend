const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/error.middleware');

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://vroomshare-frontend.vercel.app",
  "https://vroomshare.vercel.app"
];
app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.json({ ok: true, msg: 'VroomShare API' }));

app.use('/api', routes);

app.use(errorHandler);

module.exports = app;
