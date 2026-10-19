const OpenAI = require('openai');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Goal = require('../models/Goal');
const { analyzeTransactions } = require('../services/insightEngine');
const { buildBenchmark } = require('../services/regionalBenchmark');
const { buildFinancialDashboard } = require('../services/financialDashboard');
const { parseNaturalLanguageScenario } = require('../utils/whatIfEngine');

const formatINR = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
}).format(Number(amount) || 0);

const GROQ_API_KEY = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const openai = new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: GROQ_BASE_URL,
    timeout: 30000,
    maxRetries: 1
});

const generateWithAI = async (messages) => {
    if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not configured');
    }

    // Groq supports OpenAI's Chat Completions format at its compatible API endpoint.
    const response = await openai.chat.completions.create({
        model: GROQ_MODEL,
        messages
    });

    const text = response.choices?.[0]?.message?.content;
    if (!text) throw new Error("AI returned no text response");
    return text;
};

const logGroqError = (err) => {
    console.error('[Groq] Chat request failed', {
        status: err.status,
        code: err.code,
        type: err.type,
        requestId: err.request_id || err.requestId,
        message: err.message
    });
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
        const { question, mode = 'friendly' } = req.body;
        if (!question || typeof question !== 'string' || !question.trim()) {
            return res.status(400).json({ error: 'A chat question is required.' });
        }

        const [transactions, goals, user] = await Promise.all([
            Transaction.find({ userId: req.user.id }),
            Goal.find({ userId: req.user.id }),
            User.findById(req.user.id).select('location locationRegion openingBalance')
        ]);
        const balance = (user?.openingBalance || 0) + transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
        if (!transactions.length && !user?.openingBalance) return res.json({ answer: 'You do not have any balance or transactions recorded yet. Add your opening balance or transactions first, and I can give advice based on your actual numbers.' });

        // Try the real AI
        try {
            const analysis = analyzeTransactions(transactions, goals, new Date(), user?.openingBalance || 0);
            const safeMode = ['friendly', 'serious', 'roast'].includes(mode) ? mode : 'friendly';
            const tone = safeMode === 'serious' ? 'Use a direct, calm, practical tone. Be concise and do not use jokes or emojis.' : safeMode === 'roast' ? 'Use a playful, light roast about spending habits, but never shame, insult, or ridicule the user. End with one supportive practical step.' : 'Use a friendly, encouraging, simple, student-friendly, non-judgmental tone. You may use one appropriate emoji.';
            const goalContext = goals.map((goal) => ({ name: goal.targetName, target: goal.targetAmount, saved: goal.currentAmount, status: goal.status, daysRemaining: goal.deadline ? Math.max(0, Math.ceil((new Date(goal.deadline) - new Date()) / 86400000)) : null }));
            const recentTransactions = transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12).map((t) => ({ type: t.type, title: t.title, category: t.category, amount: t.amount, date: t.date }));
            const answer = await generateWithAI([
                { role: "system", content: `You are an Indian financial literacy coach. ${tone} Follow these principles:
1. Never criticize goal contributions as "small" or "insufficient". Long-term goals take time.
2. Acknowledge healthy spending and when the spending pace looks manageable for the remaining days of the month.
3. If spending is high relative to income, focus analysis on actual spending categories and available balance.
4. Recognize newly created goals and consistent monthly goal transfers with encouragement.
5. Use supplied user numbers in INR (e.g. ₹18,000); do not invent numbers or benchmarks.` },
                { role: "user", content: `Financial profile: ${JSON.stringify({ location: user?.location || 'Not set', region: user?.locationRegion || '', balance, financialHealth: analysis.health, spendingPatterns: analysis.alerts.map(({ title, whatHappened, tag, priority }) => ({ title, whatHappened, tag, priority })), categoryTotals: analysis.categoryTotals, goals: goalContext, recentTransactions })}` },
                { role: "user", content: question.trim() }
            ]);

            return res.json({ answer });
        } catch (err) {
            logGroqError(err);
            console.warn('[AI Chat] Falling back to the local intelligence engine.');
            return res.json({ answer: getSmartLocalResponse(question, balance, transactions) });
        }

    } catch (err) {
        console.error('[AI Chat] Request failed before OpenAI could be called:', err);
        res.status(500).json({ error: 'Unable to process the chat request.' });
    }
};

// 2. AI INSIGHTS (Hybrid Mode)
exports.getAIInsights = async (req, res) => {
    try {
        const [transactions, goals, user] = await Promise.all([
            Transaction.find({ userId: req.user.id }),
            Goal.find({ userId: req.user.id }),
            User.findById(req.user.id).select('openingBalance')
        ]);
        const analysis = analyzeTransactions(transactions, goals, new Date(), user?.openingBalance || 0);
        res.json({ insights: analysis.summary, alerts: analysis.alerts, mistakeTags: analysis.mistakeTags, health: analysis.health });
    } catch (err) {
        res.json({ insights: 'Insights are temporarily unavailable.', alerts: [], mistakeTags: [] });
    }
};

// 3. VOICE/TEXT PARSING (Local First - Fast & Reliable)
exports.parseVoiceCommand = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'Voice text is required.' });
        const normalizedText = text.trim().replace(/,/g, '');
        const amountMatch = normalizedText.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i);
        const amount = amountMatch ? Number(amountMatch[1]) : 0;
        if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'I could not find a valid amount. Try “I spent ₹250 on lunch today.”' });
        
        // Simple logic to guess category
        let category = "General";
        if (/(food|lunch|dinner|pizza|burger|eat)/i.test(text)) category = "Food";
        if (/(uber|petrol|fuel|bus|train|ola)/i.test(text)) category = "Transport";
        if (/(rent|bill|electricity|water)/i.test(text)) category = "Bills";
        const type = /(received|earned|salary|income)/i.test(text) ? 'income' : 'expense';
        const now = new Date();
        if (/yesterday/i.test(text)) now.setDate(now.getDate() - 1);
        const date = now.toISOString().slice(0, 10);
        const descriptionMatch = normalizedText.match(/\b(?:on|for)\s+(.+?)(?:\s+(?:today|yesterday))?[.!?]?$/i);
        const title = descriptionMatch?.[1]?.trim().replace(/\b(today|yesterday)\b/ig, '').trim()
            || (type === 'income' ? 'Income' : 'Expense');

        res.json({
            title: title.charAt(0).toUpperCase() + title.slice(1),
            amount: amount,
            type,
            category: category,
            date
        });
    } catch (err) {
        res.status(500).json({ error: "Parser failed" });
    }
};

exports.getLocationBenchmark = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('location locationRegion');
        const transactions = await Transaction.find({ userId: req.user.id });
        const benchmark = buildBenchmark(transactions, user?.location || 'Global');
        res.json({
            location: user?.location || 'India',
            region: user?.locationRegion || '',
            ...benchmark,
            comparison: benchmark.adjustedBudgetLimit === null
                ? 'Add expenses across one or more months to establish a personal spending baseline.'
                : `Your monthly spending baseline of ${formatINR(benchmark.baselineMonthlySpend)} is adjusted to ${formatINR(benchmark.adjustedBudgetLimit)} for ${user?.location || 'your selected region'} (regional index ${benchmark.costIndex.toFixed(2)}).`
        });
    } catch (err) {
        res.status(500).json({ error: 'Unable to calculate the monthly spending benchmark.' });
    }
};

exports.getFinancialDashboard = async (req, res) => {
    try {
        const [transactions, goals, user] = await Promise.all([
            Transaction.find({ userId: req.user.id }),
            Goal.find({ userId: req.user.id }),
            User.findById(req.user.id).select('location openingBalance')
        ]);
        const analysis = analyzeTransactions(transactions, goals);
        const dashboard = buildFinancialDashboard(transactions, goals, user?.location || 'Global', new Date(), user?.openingBalance || 0);
        res.json({ health: analysis.health, reasons: analysis.alerts.map((item) => ({ title: item.title, action: item.action })).slice(0, 4), ...dashboard });
    } catch (err) {
        console.error('[Dashboard] Financial metrics failed:', err);
        res.status(500).json({ error: 'Unable to calculate financial dashboard metrics.' });
    }
};

// 6. WHAT-IF SCENARIO NATURAL LANGUAGE PARSER
exports.parseWhatIfScenario = async (req, res) => {
    try {
        const { query, conversationContext } = req.body;
        if (!query || typeof query !== 'string' || !query.trim()) {
            return res.status(400).json({ error: 'A what-if query is required.' });
        }

        // Try AI structured extraction first if GROQ_API_KEY is available
        if (GROQ_API_KEY) {
            try {
                const prompt = `You are a financial natural language understanding model.
Convert the user's what-if question into a JSON object matching this schema:
{
  "scenarioType": "EXPENSE_CHANGE" | "INCOME_CHANGE" | "ADDITIONAL_SAVINGS" | "ONE_TIME_PURCHASE" | "AFFORDABILITY_CHECK" | "INCOME_LOSS" | "STATUS_QUO" | "SAVE_ALL_SURPLUS" | "COMBINED",
  "isComplete": boolean,
  "needsClarification": boolean,
  "clarificationQuestion": string or null,
  "clarificationOptions": string[] or null,
  "components": [
    {
      "targetType": "CATEGORY" | "OVERALL_SPENDING" | "INCOME" | "SAVINGS" | "ONE_TIME_PURCHASE",
      "category": "Food" | "Transport" | "Entertainment" | "Shopping" | "Bills" | null,
      "direction": "REDUCE" | "INCREASE",
      "changeType": "PERCENTAGE" | "FIXED_AMOUNT" | "ALL_SURPLUS",
      "changeValue": number or null,
      "frequency": "one_time" | "weekly" | "monthly" | "yearly",
      "durationMonths": number or null
    }
  ]
}

CRITICAL RULES:
1. If the question is about saving money (e.g. "What if I save ₹2,000 more every month?", "What if I save extra ₹1,500?"), set scenarioType "ADDITIONAL_SAVINGS" with targetType "SAVINGS" and direction "INCREASE". NEVER classify saving money as an expense or spending increase.
2. If the question is about an affordable one-time item (e.g. "Could I afford a ₹15,000 phone this month?", "What if I buy a laptop for ₹80,000?"), set scenarioType "ONE_TIME_PURCHASE" with targetType "ONE_TIME_PURCHASE" and frequency "one_time".
3. If the question is ambiguous or incomplete (e.g. "What if I by 20%?" or "What if I save more?" without an amount), set "needsClarification": true, provide a polite clarificationQuestion, and suggest options. DO NOT guess the category, amount, or direction.
4. If "What if I increase it by 20%?" is asked and prior context mentions a category, use that category. Otherwise, ask what "it" refers to.
5. DO NOT invent user bank account numbers, income, transactions, or balance figures. Only return the parsed intent and structured parameters.
6. Output raw JSON only.

User query: "${query.trim()}"
Prior Context: ${JSON.stringify(conversationContext || {})}`;

                const rawJson = await generateWithAI([
                    { role: "system", content: "You output only valid JSON with no markdown formatting." },
                    { role: "user", content: prompt }
                ]);

                const cleaned = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleaned);

                if (parsed && typeof parsed.needsClarification === 'boolean' && Array.isArray(parsed.components)) {
                    return res.json({ scenario: parsed, source: 'ai' });
                }
            } catch (aiErr) {
                logGroqError(aiErr);
                console.warn('[What-If Parser] AI parsing failed or unconfigured, falling back to local engine.');
            }
        }

        // Deterministic local engine fallback (Zero failure rate)
        const scenario = parseNaturalLanguageScenario(query, conversationContext);
        return res.json({ scenario, source: 'local' });
    } catch (err) {
        console.error('[What-If Parser] Error:', err);
        return res.status(500).json({ error: 'Failed to parse scenario.' });
    }
};

// 5. EXPLAIN FINANCIAL CONCEPT (Literacy Hub Educational Explainer)
const EDUCATIONAL_FALLBACKS = {
    budget: `**Budgeting & Saving: The 50/30/20 Framework**

Budgeting is about giving your money purpose before you spend it. A proven, practical method is the 50/30/20 rule:

• **50% Needs**: Essential living costs (Rent, utilities, groceries, medicines, loan minimums).
• **30% Wants**: Discretionary lifestyle choices (Dining out, streaming services, shopping, leisure).
• **20% Savings & Investments**: Emergency savings, retirement SIPs, index funds, debt prepayment.

**Realistic Example (₹50,000 Monthly Income):**
- Needs (50%): ₹25,000
- Wants (30%): ₹15,000
- Savings (20%): ₹10,000
*By automating the ₹10,000 transfer on salary day, you accumulate ₹1,20,000 in your first year without constant sacrifice.*

**Key Takeaway:** Pay yourself first. Move your 20% savings the moment your salary arrives, then comfortably spend what remains on your needs and wants.`,

    compound_interest: `**Compound Interest: How Money Multiplies Over Time**

Compound interest is earnings on both your initial principal and on the interest accumulated over previous periods. While simple interest grows linearly, compound interest grows exponentially.

**Realistic Example (Monthly SIP of ₹10,000 at 12% annual return):**
• **After 10 Years:** You invested ₹12 Lakhs → Value is **₹23.2 Lakhs** (Interest gained: ₹11.2 Lakhs).
• **After 20 Years:** You invested ₹24 Lakhs → Value is **₹99.9 Lakhs** (Interest gained: ₹75.9 Lakhs!).
• *Notice:* In the second 10 years, your money made over 6 times the returns of the first 10 years, simply through compounding time.

**Key Takeaway:** Time in the market beats timing the market. Starting even 5 years earlier dramatically magnifies your final wealth.`,

    inflation: `**Inflation: Understanding Purchasing Power Erosion**

Inflation is the gradual decrease in the purchasing power of your money over time, reflected in the general increase of prices.

**Realistic Example (Monthly Household Basket):**
If you spend ₹30,000/month today on living essentials:
• At 6% average annual inflation, the same goods will cost **₹53,725 in 10 years** and **₹96,214 in 20 years**.
• Money left in a 3% regular savings account loses 3% of real purchasing power every single year.

**Key Takeaway:** Cash in bank accounts provides safety of principal, but guarantees loss of purchasing power. Invest in equity index funds or inflation-beating assets for long-term goals.`,

    loans_emi: `**Loans & EMI: The Hidden Cost of Borrowing**

An Equated Monthly Installment (EMI) consists of both principal repayment and interest charges. In long-term loans (like home loans), interest dominates the first half of the repayment schedule.

**Realistic Example (₹30,00,000 Home Loan at 9% for 20 Years):**
• Monthly EMI: **₹26,992**
• Total Amount Repaid: **₹64,78,034**
• Total Interest Paid: **₹34,78,034** (More than the loan principal itself!)
• *The Prepayment Hack:* Paying just one extra EMI per year (₹27,000) cuts your tenure from 20 years to ~16 years, saving over ₹7 Lakhs in interest.

**Key Takeaway:** Keep personal debt minimal. On long-term mortgages, prepaying small amounts early slashes total interest significantly.`,

    credit_score: `**Credit Scores: Your Financial Reputation**

In India, credit bureaus (such as CIBIL and Experian) score individuals from 300 to 900.
• **750+:** Prime borrower. Unlocks the lowest loan rates and instant approvals.
• **650–749:** Average. Higher rates and stricter underwriting.
• **Below 650:** High risk. High rejection rate.

**Key Habits to Build a 750+ Score:**
1. Pay 100% of your credit card bill before the due date (never pay only minimum due).
2. Keep credit utilization below 30% of your available limit.
3. Avoid applying for multiple new credit cards or personal loans within a short span.

**Key Takeaway:** Your credit score directly impacts loan interest rates. A difference between 8.4% and 9.6% on a home loan can cost you over ₹9 Lakhs in extra interest.`,

    insurance: `**Insurance Essentials: Protection Over Investment**

Insurance is not designed to grow wealth; it is designed to protect wealth from catastrophe. Every working individual requires two fundamentals:

1. **Pure Term Life Insurance:** Provides a high lump-sum payout (10–15x annual income) to your family in the event of untimely demise. Costs only ₹800–₹1,200/month for ₹1 Crore cover.
2. **Comprehensive Health Insurance:** Covers hospitalization and surgical expenses, shielding your savings from medical inflation.

**Key Mistake to Avoid:** Never buy traditional endowment or ULIP policies promising "insurance + investment". They provide insufficient coverage and poor returns.

**Key Takeaway:** Buy pure term insurance for life risk and separate health insurance for medical risk. Invest your remaining savings independently in index funds.`,

    taxes: `**Direct Taxes: Old vs. New Tax Regime Explained**

Under the Indian Income Tax framework, you can select between two regimes:

• **New Tax Regime (Default):** Features simplified lower slab rates with no requirement for investment proofs. In FY 2024–25, income up to ₹7.75 Lakhs is effectively tax-free (with standard deduction and rebate).
• **Old Tax Regime:** Higher slab rates, but allows deductions like Section 80C (up to ₹1.5L), 80D (health insurance), HRA, and home loan interest.

**Realistic Example:**
If your annual income is ₹9 Lakhs:
- New Regime Tax: ~₹35,000.
- Old Regime Tax (without deductions): ~₹96,200.
- Old Regime Tax with ₹3 Lakhs total deductions: ~₹30,000.

**Key Takeaway:** If your total deductions (80C, HRA, 80D) are less than ₹2.5–3 Lakhs, the New Regime is cleaner, hassle-free, and saves more tax.`,

    stocks_mutual_funds: `**Stocks & Mutual Funds: Building Long-Term Wealth**

• **Individual Stock:** Fractional ownership in a single business. High potential growth, but subject to business-specific risks.
• **Mutual Fund:** A diversified basket of 40–80 companies managed by a fund house.
• **Broad Index Fund (Nifty 50):** Automatically invests in India's top 50 companies with minimal management fees (~0.1%). It removes manager risk and captures the growth of the broader Indian economy.

**Realistic Example (₹5,000 Monthly SIP in Nifty 50 for 15 Years):**
- Total Invested: ₹9,00,000
- Value at 12.5% Historical Average CAGR: **₹25.2 Lakhs**
- Capital Gains: **₹16.2 Lakhs**

**Key Takeaway:** Beginners should avoid intraday trading and speculative stock tips. A disciplined monthly SIP into a low-cost index fund is the most reliable path to financial independence.`
};

function getEducationalFallback(question) {
    const q = (question || '').toLowerCase();
    if (q.includes('compound') || q.includes('interest') || q.includes('rule of 72') || q.includes('grow')) {
        return EDUCATIONAL_FALLBACKS.compound_interest;
    }
    if (q.includes('inflat') || q.includes('purchasing power') || q.includes('price rise')) {
        return EDUCATIONAL_FALLBACKS.inflation;
    }
    if (q.includes('budget') || q.includes('50/30/20') || q.includes('saving') || q.includes('save') || q.includes('spend')) {
        return EDUCATIONAL_FALLBACKS.budget;
    }
    if (q.includes('loan') || q.includes('emi') || q.includes('prepay') || q.includes('debt') || q.includes('borrow')) {
        return EDUCATIONAL_FALLBACKS.loans_emi;
    }
    if (q.includes('credit') || q.includes('cibil') || q.includes('score') || q.includes('card')) {
        return EDUCATIONAL_FALLBACKS.credit_score;
    }
    if (q.includes('insur') || q.includes('term') || q.includes('health') || q.includes('life')) {
        return EDUCATIONAL_FALLBACKS.insurance;
    }
    if (q.includes('tax') || q.includes('regime') || q.includes('80c') || q.includes('deduct')) {
        return EDUCATIONAL_FALLBACKS.taxes;
    }
    if (q.includes('stock') || q.includes('mutual') || q.includes('sip') || q.includes('index') || q.includes('equity') || q.includes('invest')) {
        return EDUCATIONAL_FALLBACKS.stocks_mutual_funds;
    }
    return `**Understanding Financial Basics**

Personal finance is built on four core pillars:
1. **Cash Flow Control:** Knowing your monthly income vs expenses.
2. **Emergency Preparedness:** Keeping 3–6 months of essential living expenses safe in a liquid account.
3. **Risk Protection:** Securing adequate health insurance and pure term life insurance.
4. **Inflation-Beating Investments:** Investing systematically in low-cost index funds or diversified mutual funds for long-term goals.

**Key Takeaway:** Focus on consistency and simplicity over complex trading strategies. Start with budgeting and building your emergency buffer today.`;
}

exports.explainConcept = async (req, res) => {
    try {
        const { question, topic } = req.body;
        if (!question || typeof question !== 'string' || !question.trim()) {
            return res.status(400).json({ error: 'A question is required.' });
        }

        if (GROQ_API_KEY) {
            try {
                const promptMessages = [
                    {
                        role: "system",
                        content: `You are FinWise AI, an expert financial educator specializing in simple, intuitive explanations of personal finance and economics for Indian learners.
Principles to follow:
1. Explain concepts in clear, student-friendly, jargon-free language.
2. When numbers or calculations are needed, use Indian Rupees (₹) and realistic examples.
3. Structure your response cleanly with clear section headings or bullet points: Core Concept → Realistic Numerical Example → Step-by-Step Breakdown → Key Takeaway.
4. Never promise or guarantee financial returns (e.g. never claim equities guarantee 15%).
5. Keep explanations direct, concise (2-4 paragraphs maximum), and empowering.`
                    },
                    {
                        role: "user",
                        content: topic ? `Topic: ${topic}\nQuestion: ${question.trim()}` : question.trim()
                    }
                ];

                const answer = await generateWithAI(promptMessages);
                return res.json({ answer, source: 'ai' });
            } catch (err) {
                logGroqError(err);
                console.warn('[AI Explain] Groq unavailable, using curated educational fallback.');
            }
        }

        // Reliable fallback
        return res.json({
            answer: getEducationalFallback(question),
            source: 'educational-knowledge-base'
        });
    } catch (err) {
        console.error('[AI Explain] Controller error:', err);
        return res.status(500).json({ error: 'Unable to explain financial concept at this time.' });
    }
};

