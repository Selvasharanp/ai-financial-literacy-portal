const express = require('express');
const router = express.Router();
const { addGoal, getGoals, updateGoalProgress, deleteGoal } = require('../controllers/goalController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, addGoal);
router.get('/', auth, getGoals);
router.put('/:id', auth, updateGoalProgress);
router.delete('/:id', auth, deleteGoal);

module.exports = router;