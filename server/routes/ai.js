const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// ALL imports must be in ONE curly brace block
const { 
    getAIInsights, 
    chatWithAI, 
    getLocationBenchmark, 
    parseVoiceCommand 
} = require('../controllers/aiController');

// @route   GET /api/ai/insights
// @desc    Get AI-generated financial advice based on transaction history
router.get('/insights', auth, getAIInsights);

// @route   POST /api/ai/chat
// @desc    Chat with the financial AI
router.post('/chat', auth, chatWithAI);

// @route   POST /api/ai/parse-voice
// @desc    Convert voice transcript into structured JSON data
router.post('/parse-voice', auth, parseVoiceCommand);

// @route   GET /api/ai/benchmark
// @desc    Compare spending to city averages
router.get('/benchmark', auth, getLocationBenchmark);

module.exports = router;