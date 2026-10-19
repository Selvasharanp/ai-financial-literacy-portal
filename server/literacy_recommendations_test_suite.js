const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Goal = require('./models/Goal');
const literacyController = require('./controllers/literacyController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fin_literacy_db';

console.log('===========================================================');
console.log('=== PHASE 2: LITERACY HUB PERSONALIZATION TEST SUITE ===');
console.log('===========================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        console.log(`✅ [PASS] ${message}`);
        passedTests++;
    } else {
        console.error(`❌ [FAIL] ${message}`);
    }
}

// Mock request / response helper
function mockReqRes(userId, query = {}) {
    return new Promise((resolve, reject) => {
        const req = { user: { id: userId }, query };
        const res = {
            json: (data) => resolve({ status: 200, body: data }),
            status: (code) => ({
                json: (data) => resolve({ status: code, body: data })
            })
        };
        literacyController.getRecommendedContent(req, res).catch(reject);
    });
}

async function runTests() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB for testing\n');

        const testUserId = new mongoose.Types.ObjectId().toString();

        // ----------------------------------------------------
        // TEST 1 — High Food Spending
        // ----------------------------------------------------
        console.log('[TEST 1] High Food Spending scenario...');
        await Transaction.deleteMany({ userId: testUserId });
        await Goal.deleteMany({ userId: testUserId });

        await Transaction.create([
            { userId: testUserId, title: 'Monthly Salary', category: 'Salary', type: 'income', amount: 40000, isCredited: true, date: new Date() },
            { userId: testUserId, title: 'Food Delivery', category: 'Food', type: 'expense', amount: 8000, date: new Date() },
            { userId: testUserId, title: 'Restaurant', category: 'Food', type: 'expense', amount: 4000, date: new Date() }
        ]);

        const res1 = await mockReqRes(testUserId);
        assert(res1.body.detectedIssue.includes('Food'), 'Recommends food spending management education for high food spending.');
        assert(res1.body.recommendations[0].learning.category === 'food', 'Educational module category is food.');


        // ----------------------------------------------------
        // TEST 2 — Subscription-Heavy Spending
        // ----------------------------------------------------
        console.log('\n[TEST 2] Subscription-Heavy Spending scenario...');
        await Transaction.deleteMany({ userId: testUserId });
        await Transaction.create([
            { userId: testUserId, title: 'Salary', category: 'Salary', type: 'income', amount: 40000, isCredited: true, date: new Date() },
            { userId: testUserId, title: 'Netflix & Spotify Subscriptions', category: 'Subscriptions', type: 'expense', amount: 2500, date: new Date() }
        ]);

        const res2 = await mockReqRes(testUserId);
        assert(res2.body.detectedIssue.toLowerCase().includes('subscription'), 'Recommends subscription audit education.');
        assert(res2.body.recommendations[0].learning.category === 'subscriptions', 'Educational module category is subscriptions.');


        // ----------------------------------------------------
        // TEST 3 — Spending Spike & Impulse
        // ----------------------------------------------------
        console.log('\n[TEST 3] Spending Spike & Impulse scenario...');
        await Transaction.deleteMany({ userId: testUserId });
        const now = new Date();
        await Transaction.create([
            { userId: testUserId, title: 'Salary', category: 'Salary', type: 'income', amount: 50000, isCredited: true, date: new Date() },
            { userId: testUserId, title: 'Tea', category: 'General', type: 'expense', amount: 200, date: new Date(now.getFullYear(), now.getMonth(), 2) },
            { userId: testUserId, title: 'Coffee', category: 'General', type: 'expense', amount: 300, date: new Date(now.getFullYear(), now.getMonth(), 5) },
            { userId: testUserId, title: 'Snack', category: 'General', type: 'expense', amount: 250, date: new Date(now.getFullYear(), now.getMonth(), 10) },
            { userId: testUserId, title: 'Impulse Shopping Spike', category: 'Shopping', type: 'expense', amount: 12000, date: now }
        ]);

        const res3 = await mockReqRes(testUserId);
        assert(res3.body.detectedIssue.toLowerCase().includes('impulse') || res3.body.detectedIssue.toLowerCase().includes('spike'), 'Recommends impulse control & spending spike education.');


        // ----------------------------------------------------
        // TEST 4 — New Goal Created
        // ----------------------------------------------------
        console.log('\n[TEST 4] New Goal Created scenario...');
        await Transaction.deleteMany({ userId: testUserId });
        await Goal.deleteMany({ userId: testUserId });
        await Transaction.create([
            { userId: testUserId, title: 'Salary', category: 'Salary', type: 'income', amount: 35000, isCredited: true, date: new Date() },
            { userId: testUserId, title: 'Bills', category: 'Bills', type: 'expense', amount: 10000, date: new Date() }
        ]);
        await Goal.create({ userId: testUserId, targetName: 'Laptop Fund', targetAmount: 70000, currentAmount: 2000, status: 'active', createdAt: new Date() });

        const res4 = await mockReqRes(testUserId);
        assert(res4.body.detectedIssue.toLowerCase().includes('goal'), 'Recommends goal planning education for new goal.');
        assert(!res4.body.recommendations[0].whatHappened.toLowerCase().includes('too small'), 'Does NOT criticize initial goal contribution amount.');


        // ----------------------------------------------------
        // TEST 5 — Consistent Monthly Goal Contribution
        // ----------------------------------------------------
        console.log('\n[TEST 5] Consistent Monthly Goal Contribution scenario...');
        await Transaction.deleteMany({ userId: testUserId });
        await Goal.deleteMany({ userId: testUserId });
        await Transaction.create([
            { userId: testUserId, title: 'Salary', category: 'Salary', type: 'income', amount: 50000, isCredited: true, date: new Date() },
            { userId: testUserId, title: 'Living', category: 'General', type: 'expense', amount: 15000, date: new Date() }
        ]);
        await Goal.create({ userId: testUserId, targetName: 'Emergency Savings', targetAmount: 100000, currentAmount: 25000, status: 'active', createdAt: new Date(now.getFullYear(), now.getMonth() - 2, 1) });

        const res5 = await mockReqRes(testUserId);
        assert(res5.body.detectedIssue.toLowerCase().includes('goal') || res5.body.detectedIssue.toLowerCase().includes('consistent'), 'Recognizes consistent goal contributions.');


        // ----------------------------------------------------
        // TEST 6 — Healthy Spending (Advanced Topics)
        // ----------------------------------------------------
        console.log('\n[TEST 6] Healthy Spending scenario...');
        await Transaction.deleteMany({ userId: testUserId });
        await Goal.deleteMany({ userId: testUserId });
        await Transaction.create([
            { userId: testUserId, title: 'Salary', category: 'Salary', type: 'income', amount: 60000, isCredited: true, date: new Date() },
            { userId: testUserId, title: 'Groceries', category: 'General', type: 'expense', amount: 15000, date: new Date() }
        ]);

        const res6 = await mockReqRes(testUserId);
        assert(res6.body.detectedIssue.toLowerCase().includes('healthy') || res6.body.detectedIssue.toLowerCase().includes('advanced'), 'Recommends advanced financial literacy topics for healthy spending.');
        const category6 = res6.body.recommendations[0].learning.category;
        assert(['investing', 'credit', 'general'].includes(category6), 'Advanced module topic is investing/credit/general.');


        // ----------------------------------------------------
        // TEST 7 — Insufficient History / New User
        // ----------------------------------------------------
        console.log('\n[TEST 7] Insufficient History / New User scenario...');
        await Transaction.deleteMany({ userId: testUserId });
        await Goal.deleteMany({ userId: testUserId });

        const res7 = await mockReqRes(testUserId);
        assert(res7.body.detectedIssue.toLowerCase().includes('essentials') || res7.body.detectedIssue.toLowerCase().includes('start'), 'Recommends foundational content for new users.');
        assert(res7.body.recommendations[0].friendlyExplanation.includes('recently started'), 'Explains that patterns will be learned over time without inventing problems.');


        // ----------------------------------------------------
        // TEST 8 — Repeated Visits & Content Rotation
        // ----------------------------------------------------
        console.log('\n[TEST 8] Repeated Visits & Content Rotation scenario...');
        await Transaction.deleteMany({ userId: testUserId });
        await Transaction.create([
            { userId: testUserId, title: 'Salary', category: 'Salary', type: 'income', amount: 60000, isCredited: true, date: new Date() },
            { userId: testUserId, title: 'Groceries', category: 'General', type: 'expense', amount: 15000, date: new Date() }
        ]);

        const visit1 = await mockReqRes(testUserId, { rotate: 0 });
        const visit2 = await mockReqRes(testUserId, { rotate: 1 });

        assert(visit1.body.availableModules.length > 1, 'Multiple matching modules available for rotation.');
        assert(visit1.body.recommendations[0].learning.title !== visit2.body.recommendations[0].learning.title || visit1.body.availableModules.length === 1, 'Rotates between available modules across sequential requests.');


        console.log('\n===========================================================');
        console.log(`=== TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED ===`);
        console.log('===========================================================\n');

        // Cleanup
        await Transaction.deleteMany({ userId: testUserId });
        await Goal.deleteMany({ userId: testUserId });
        await mongoose.disconnect();

        if (passedTests === totalTests) {
            console.log('🎉 ALL PHASE 2 LITERACY HUB TESTS PASSED SUCCESSFULLY!');
            process.exit(0);
        } else {
            console.error('❌ SOME TESTS FAILED.');
            process.exit(1);
        }
    } catch (err) {
        console.error('Test error:', err);
        process.exit(1);
    }
}

runTests();
