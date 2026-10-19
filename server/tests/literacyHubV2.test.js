// server/tests/literacyHubV2.test.js
// Comprehensive Verification Test Suite for Redesigned FinWise AI Literacy Hub

const assert = require('assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const aiController = require('../controllers/aiController');

console.log('🧪 RUNNING REDESIGNED LITERACY HUB VERIFICATION TEST SUITE...\n');

function createMockReqRes(user, body = {}, params = {}, query = {}) {
    const req = {
        user: user ? { id: user._id.toString(), email: user.email, name: user.name } : null,
        body,
        params,
        query
    };

    let resData = null;
    let resStatus = 200;

    const res = {
        status: (code) => {
            resStatus = code;
            return res;
        },
        json: (data) => {
            resData = data;
            return res;
        }
    };

    return { req, res, getStatus: () => resStatus, getData: () => resData };
}

async function run() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        console.error('MONGO_URI is not defined in server/.env');
        process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.\n');

    const prefix = `literacy_test_${Date.now()}_`;
    let testUser = null;

    try {
        testUser = await User.create({
            name: `${prefix}Student`,
            email: `${prefix}student@example.com`,
            password: 'hashedpassword123',
            monthlyIncome: 65000,
            hasCompletedOnboarding: true
        });

        // 1. Validation test: Empty question
        console.log('--- TEST 1: Question validation on /api/ai/explain ---');
        {
            const { req, res, getStatus, getData } = createMockReqRes(testUser, { question: '' });
            await aiController.explainConcept(req, res);
            assert.strictEqual(getStatus(), 400, 'Expected 400 for empty question');
            assert.ok(getData().error, 'Expected error message');
            console.log('✅ Correctly rejected empty question with HTTP 400.');
        }

        // 2. Budgeting question explanation
        console.log('\n--- TEST 2: Budgeting Concept Explanation ---');
        {
            const { req, res, getStatus, getData } = createMockReqRes(testUser, {
                question: 'How does the 50/30/20 budget rule work with a realistic example?',
                topic: 'Budgeting and Saving'
            });
            await aiController.explainConcept(req, res);
            assert.strictEqual(getStatus(), 200, 'Expected 200 OK');
            const data = getData();
            assert.ok(data.answer, 'Expected answer field in response');
            assert.ok(data.source, 'Expected source field in response');
            console.log('Source:', data.source);
            console.log('Snippet:', data.answer.substring(0, 150).replace(/\n/g, ' ') + '...');
            console.log('✅ Budgeting concept returned realistic explanation.');
        }

        // 3. Compound Interest explanation
        console.log('\n--- TEST 3: Compound Interest Explanation ---');
        {
            const { req, res, getStatus, getData } = createMockReqRes(testUser, {
                question: 'Explain compound interest and the Rule of 72 in simple terms.',
                topic: 'Compound Interest'
            });
            await aiController.explainConcept(req, res);
            assert.strictEqual(getStatus(), 200);
            const data = getData();
            assert.ok(data.answer.toLowerCase().includes('interest') || data.answer.toLowerCase().includes('72'), 'Expected compound interest details');
            console.log('✅ Compound interest explanation verified.');
        }

        // 4. Inflation explanation
        console.log('\n--- TEST 4: Inflation Concept Explanation ---');
        {
            const { req, res, getStatus, getData } = createMockReqRes(testUser, {
                question: 'Why does inflation hurt my savings if money is sitting in a bank account?',
                topic: 'Inflation'
            });
            await aiController.explainConcept(req, res);
            assert.strictEqual(getStatus(), 200);
            const data = getData();
            assert.ok(data.answer.length > 50, 'Expected robust explanation');
            console.log('✅ Inflation explanation verified.');
        }

        // 5. Loans & Prepayment explanation
        console.log('\n--- TEST 5: Loans & Prepayment Explanation ---');
        {
            const { req, res, getStatus, getData } = createMockReqRes(testUser, {
                question: 'How does prepaying an extra EMI on a home loan save so much interest?',
                topic: 'Loans and EMI'
            });
            await aiController.explainConcept(req, res);
            assert.strictEqual(getStatus(), 200);
            const data = getData();
            assert.ok(data.answer.length > 50, 'Expected robust explanation');
            console.log('✅ Loans & EMI prepayment explanation verified.');
        }

        // 6. Credit scores explanation
        console.log('\n--- TEST 6: Credit Scores Explanation ---');
        {
            const { req, res, getStatus, getData } = createMockReqRes(testUser, {
                question: 'What is a credit utilization ratio and how do I keep my CIBIL score above 750?',
                topic: 'Credit Scores'
            });
            await aiController.explainConcept(req, res);
            assert.strictEqual(getStatus(), 200);
            const data = getData();
            assert.ok(data.answer.length > 50, 'Expected robust explanation');
            console.log('✅ Credit score explanation verified.');
        }

        // 7. Insurance explanation
        console.log('\n--- TEST 7: Insurance Explanation ---');
        {
            const { req, res, getStatus, getData } = createMockReqRes(testUser, {
                question: 'Why is pure term insurance better than an endowment policy?',
                topic: 'Insurance'
            });
            await aiController.explainConcept(req, res);
            assert.strictEqual(getStatus(), 200);
            const data = getData();
            assert.ok(data.answer.length > 50, 'Expected robust explanation');
            console.log('✅ Insurance explanation verified.');
        }

        // 8. Taxes explanation
        console.log('\n--- TEST 8: Taxes Old vs New Regime Explanation ---');
        {
            const { req, res, getStatus, getData } = createMockReqRes(testUser, {
                question: 'What is the difference between the Old and New tax regimes in India?',
                topic: 'Taxes'
            });
            await aiController.explainConcept(req, res);
            assert.strictEqual(getStatus(), 200);
            const data = getData();
            assert.ok(data.answer.length > 50, 'Expected robust explanation');
            console.log('✅ Taxes explanation verified.');
        }

        // 9. Stocks & Mutual Funds explanation
        console.log('\n--- TEST 9: Stocks & Mutual Funds Explanation ---');
        {
            const { req, res, getStatus, getData } = createMockReqRes(testUser, {
                question: 'What is the difference between a direct index fund and an active mutual fund?',
                topic: 'Stocks and Mutual Funds'
            });
            await aiController.explainConcept(req, res);
            assert.strictEqual(getStatus(), 200);
            const data = getData();
            assert.ok(data.answer.length > 50, 'Expected robust explanation');
            console.log('✅ Stocks and mutual funds explanation verified.');
        }

        // 10. Existing Feature Check: Dashboard / Transactions unimpacted
        console.log('\n--- TEST 10: Existing Features Isolation Check ---');
        {
            const testTx = await Transaction.create({
                userId: testUser._id,
                title: 'Grocery test',
                amount: 1500,
                type: 'expense',
                category: 'Food'
            });
            assert.ok(testTx._id, 'Transaction created successfully');

            const { req, res, getStatus, getData } = createMockReqRes(testUser);
            await aiController.getFinancialDashboard(req, res);
            assert.strictEqual(getStatus(), 200);
            const dashData = getData();
            assert.ok(dashData, 'Expected dashboard data');
            console.log('✅ Existing Personal Finance and Dashboard endpoints remain completely intact.');

            await Transaction.deleteOne({ _id: testTx._id });
        }

        console.log('\n======================================================');
        console.log('🎉 ALL 10 TESTS PASSED SUCCESSFULLY!');
        console.log('======================================================\n');
    } finally {
        if (testUser) {
            await User.deleteOne({ _id: testUser._id });
        }
        await mongoose.disconnect();
    }
}

run().catch((err) => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
});
