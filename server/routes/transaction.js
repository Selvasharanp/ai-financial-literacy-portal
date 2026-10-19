const express = require('express');
const router = express.Router();
const { 
    addTransaction, 
    updateTransaction,
    getTransactions, 
    deleteTransaction, 
    getTransactionSummary,
    toggleCreditStatus,
    creditSalaryWithGoalWorkflow,
    confirmSalaryCredit
} = require('../controllers/transactionController');
const auth = require('../middleware/authMiddleware');

// All routes here are protected by the auth middleware
router.post('/', auth, addTransaction);
router.get('/', auth, getTransactions);
router.get('/summary', auth, getTransactionSummary);
router.post('/confirm-salary', auth, confirmSalaryCredit);
router.patch('/:id/credit', auth, toggleCreditStatus);
router.post('/:id/credit-with-goal', auth, creditSalaryWithGoalWorkflow);
router.put('/:id', auth, updateTransaction);
router.delete('/:id', auth, deleteTransaction);

module.exports = router;

