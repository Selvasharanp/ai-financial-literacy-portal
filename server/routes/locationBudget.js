// server/routes/locationBudget.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getAdvice, detectLocation } = require('../controllers/locationBudgetController');

// @route   POST /api/location-budget/advice
// @desc    Calculate deterministic location-based budget advice
router.post('/advice', auth, getAdvice);

// @route   POST /api/location-budget/detect
// @desc    Reverse geocode coordinates into city/town
router.post('/detect', auth, detectLocation);

module.exports = router;
