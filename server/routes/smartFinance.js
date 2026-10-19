const router = require('express').Router();
const authenticate = require('../middleware/authMiddleware');
const controller = require('../controllers/smartFinanceController');

router.post('/scenarios', authenticate, controller.runScenario);
router.get('/scenarios', authenticate, controller.getScenarios);
router.get('/recurring', authenticate, controller.getRecurring);
router.put('/recurring/:id', authenticate, controller.setRecurringPreference);
router.get('/summary', authenticate, controller.getMonthlySummary);
router.get('/challenges', authenticate, controller.getChallenges);
router.post('/challenges', authenticate, controller.startChallenge);

module.exports = router;
