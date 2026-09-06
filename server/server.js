const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transaction');
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', transactionRoutes);
app.use('/api/ai', require('./routes/ai'));
app.use('/api/literacy', require('./routes/literacy'));
app.use('/api/goals', require('./routes/goal'));

// Test Route
app.get('/', (req, res) => {
    res.send('AI Financial Portal API is running...');
});

// Database Connection
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB Connected Successfully');
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
    });