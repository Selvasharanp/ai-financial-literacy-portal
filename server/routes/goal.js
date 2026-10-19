const express = require('express');
const router = express.Router();
const { 
    addGoal, 
    getGoals, 
    updateGoalProgress, 
    allocateToGoal, 
    emergencyWithdrawal, 
    skipAllocation, 
    getMonthlyGoalStatus,
    deleteGoal 
} = require('../controllers/goalController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, addGoal);
router.get('/', auth, getGoals);
router.get('/monthly-status', auth, getMonthlyGoalStatus);
router.post('/skip', auth, skipAllocation);
router.post('/:id/allocate', auth, allocateToGoal);
router.post('/:id/withdraw', auth, emergencyWithdrawal);
router.post('/:id/emergency-withdraw', auth, emergencyWithdrawal);
router.put('/:id', auth, updateGoalProgress);
router.delete('/:id', auth, deleteGoal);

module.exports = router;