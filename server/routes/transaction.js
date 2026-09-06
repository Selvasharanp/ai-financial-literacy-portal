const express = require('express');
const router = express.Router();
const { 
    addTransaction, 
    getTransactions, 
    deleteTransaction, 
    getTransactionSummary 
} = require('../controllers/transactionController');
const auth = require('../middleware/authMiddleware');

// All routes here are protected by the auth middleware
router.post('/', auth, addTransaction);
router.get('/', auth, getTransactions);
router.get('/summary', auth, getTransactionSummary);
router.delete('/:id', auth, deleteTransaction);

module.exports = router;