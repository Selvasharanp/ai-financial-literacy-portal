const router = require('express').Router();
const authenticate = require('../middleware/authMiddleware');
const { createExpenseSplit, getExpenseSplits } = require('../controllers/expenseSplitController');

router.post('/', authenticate, createExpenseSplit);
router.get('/', authenticate, getExpenseSplits);

module.exports = router;
