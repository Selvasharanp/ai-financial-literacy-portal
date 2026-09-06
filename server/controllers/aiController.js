const axios = require('axios');
const https = require('https');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { analyzeTransactions } = require('../services/insightEngine');

const formatINR = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
}).format(Number(amount) || 0);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent";
const geminiClient = axios.create({
    // Avoid Node's IPv6 DNS path on Windows.
    httpsAgent: new https.Agent({ family: 4 }),
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 30000
});

const generateWithAI = async (messages) => {
    const response = await geminiClient.post(GEMINI_ENDPOINT, {
        contents: messages.map(({ role, content }) => ({
            role: role === 'assistant' ? 'model' : 'user',
            parts: [{ text: content }]
        }))
    }, {
        params: { key: GEMINI_API_KEY }
    });

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI returned no text response");
    return text;
};

// --- SMART LOCAL ENGINE (Works when Internet Fails) ---
const getSmartLocalResponse = (question, balance, transactions) => {
    const q = question.toLowerCase();
    if (q.includes("balance")) return `Your current node balance is ${formatINR(balance)}. Status: Synchronized.`;
    if (q.includes("spend") || q.includes("broke")) {
        const topExp = transactions.filter(t => t.type === 'expense').sort((a,b) => b.amount - a.amount)[0];
        return topExp ? `Analysis: Your largest leak is ${topExp.title} (${formatINR(topExp.amount)}). Optimize this category to improve liquidity.` : "No major leaks detected in current data cycle.";
    }
    if (q.includes("pizza") || q.includes("food") || q.includes("eat")) return "Food expenses detected. Smart Suggestion: Meal prep for 3 days to increase weekly savings by 12%.";
    return "I am currently operating in Local Mode. I can see your transactions are secure. How can I assist with your manual ledger?";
};

// 1. CHATBOT (Hybrid Mode)
exports.chatWithAI = async (req, res) => {
    try {
        const { question } = req.body;
        const transactions = await Transaction.find({ userId: req.user.id });
        const balance = transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
        if (!transactions.length) return res.json({ answer: 'You do not have any transactions yet. Add your income and expenses first, and I can give advice based on your actual numbers.' });

        // Try the real AI
        const answer = await generateWithAI([
            { role: "user", content: `You are an Indian financial literacy assistant. Use only this user data: ${JSON.stringify(transactions.map(t => ({ type: t.type, category: t.category, amount: t.amount, date: t.date })))}. Balance: ${formatINR(balance)}. Do not invent transactions. Give a short, practical answer in INR.` },
            { role: "user", content: question }
        ]);

        res.json({ answer });

    } catch (err) {
        // FAIL-SAFE: If DNS fails, use the Local Smart Engine
        const transactions = await Transaction.find({ userId: req.user.id });
        const balance = transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
        
        console.log("!!! DNS/Network Failed. Switching to Local Intelligence Engine.");
        const localAnswer = getSmartLocalResponse(req.body.question, balance, transactions);
        res.json({ answer: localAnswer });
    }
};

// 2. AI INSIGHTS (Hybrid Mode)
exports.getAIInsights = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id });
        const analysis = analyzeTransactions(transactions);
        res.json({ insights: analysis.summary, alerts: analysis.alerts, mistakeTags: analysis.mistakeTags });
    } catch (err) {
        res.json({ insights: 'Insights are temporarily unavailable.', alerts: [], mistakeTags: [] });
    }
};

// 3. VOICE/TEXT PARSING (Local First - Fast & Reliable)
exports.parseVoiceCommand = async (req, res) => {
    try {
        const { text } = req.body;
        const amountMatch = text.match(/\d+/);
        const amount = amountMatch ? parseInt(amountMatch[0]) : 0;
        
        // Simple logic to guess category
        let category = "General";
        if (/(food|lunch|dinner|pizza|burger|eat)/i.test(text)) category = "Food";
        if (/(uber|petrol|fuel|bus|train|ola)/i.test(text)) category = "Transport";
        if (/(rent|bill|electricity|water)/i.test(text)) category = "Bills";

        res.json({
            title: text.replace(/\d+/g, '').replace(/(spent|on|bought|paid)/gi, '').trim() || "Expense",
            amount: amount,
            type: "expense",
            category: category
        });
    } catch (err) {
        res.status(500).json({ error: "Parser failed" });
    }
};

exports.getLocationBenchmark = async (req, res) => {
    const indices = { Mumbai: 1.3, Delhi: 1.2, Bengaluru: 1.2, Pune: 1.05, Hyderabad: 1.0, Chennai: 1.0, Kolkata: 0.9, Ahmedabad: 0.9, Jaipur: 0.8, 'Tier 2': 0.8, 'Tier 3': 0.65 };
    const user = await User.findById(req.user.id).select('location');
    const costIndex = indices[user?.location] || 1;
    const baseMonthlyBudget = 30000;
    res.json({ location: user?.location || 'India', costIndex, baseMonthlyBudget, adjustedBudgetLimit: Math.round(baseMonthlyBudget * costIndex), comparison: `A ${formatINR(baseMonthlyBudget)} base monthly budget becomes ${formatINR(baseMonthlyBudget * costIndex)} for ${user?.location || 'your region'}.` });
};
