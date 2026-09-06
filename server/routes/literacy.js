const express = require('express');
const router = express.Router();
const { getAllContent, getRecommendedContent, addContent } = require('../controllers/literacyController');
const auth = require('../middleware/authMiddleware');

router.get('/all', auth, getAllContent);
router.get('/recommended', auth, getRecommendedContent);
router.post('/add', auth, addContent); // Used to seed your database

module.exports = router;