const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Routes
const healthRoute = require('./routes/health');
const sheetsRoute = require('./routes/sheets');

app.use('/health', healthRoute);
app.use('/api/sheets', sheetsRoute);

module.exports = app;
