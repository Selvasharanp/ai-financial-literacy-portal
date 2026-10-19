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
let databaseReady = false;
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
    
// Middleware
app.use(cors({
    origin(origin, callback) {
        // Requests without an Origin header (health checks, curl, server-to-server) or from local dev server are allowed.
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
            return callback(null, true);
        }
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        return callback(null, false);
    },
    credentials: true
}));
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/user', transactionRoutes);
app.use('/api/ai', require('./routes/ai'));
app.use('/api/literacy', require('./routes/literacy'));
app.use('/api/goals', require('./routes/goal'));
app.use('/api/smart-finance', require('./routes/smartFinance'));
app.use('/api/expense-splits', require('./routes/expenseSplit'));
app.use('/api/trips', require('./routes/trip'));
app.use('/api', require('./routes/invitations'));
app.use('/api/travel-planner', require('./routes/travelPlanner'));
app.use('/api/location-budget', require('./routes/locationBudget'));


app.get('/api/health', (req, res) => res.json({ status: 'ok', database: databaseReady ? 'connected' : 'connecting-or-unavailable' }));

// Test Route
app.get('/', (req, res) => {
    res.send('AI Financial Portal API is running...');
});

// Database Connection
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
    .then(() => {
        databaseReady = true;
        console.log('✅ MongoDB Connected Successfully');
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
    });

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
