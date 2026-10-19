const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/authMiddleware');
const travelPlannerController = require('../controllers/travelPlannerController');

// Optional auth helper: populates req.user if a valid token is provided, but does not block if not
const optionalAuth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return next();
    try {
        const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
        req.user = decoded;
    } catch (e) {
        // Ignore invalid token on public generation routes
    }
    next();
};

// Plan generation & deterministic recalculation
router.post('/generate', optionalAuth, travelPlannerController.generatePlan);
router.post('/recalculate', optionalAuth, travelPlannerController.recalculatePlan);

// Saved plans CRUD (authenticated)
router.post('/save', auth, travelPlannerController.savePlan);
router.get('/saved', auth, travelPlannerController.getSavedPlans);
router.get('/saved/:id', auth, travelPlannerController.getSavedPlanById);
router.delete('/saved/:id', auth, travelPlannerController.deleteSavedPlan);

module.exports = router;
