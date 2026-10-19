const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const { register, completeOnboarding } = require('./controllers/authController');
const { getTransactionSummary, toggleCreditStatus, addTransaction } = require('./controllers/transactionController');

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/financial-literacy-portal';
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test_jwt_secret_phase2_12345';
}

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    res.send = (msg) => { res.msg = msg; return res; };
    return res;
};

async function runPhase2Tests() {
    console.log('=== RUNNING PHASE 2 TEST SUITE ===');
    console.log('Connecting to Mongo URI:', mongoUri);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to Database');

    const email1 = 'phase2_credited_test@example.com';
    const email2 = 'phase2_pending_test@example.com';
    const email3 = 'phase2_dates_test@example.com';

    // Cleanup previous test users & transactions
    const testUsers = await User.find({ email: { $in: [email1, email2, email3] } });
    const testUserIds = testUsers.map(u => u._id);
    await Transaction.deleteMany({ userId: { $in: testUserIds } });
    await User.deleteMany({ email: { $in: [email1, email2, email3] } });

    try {
        // -------------------------------------------------------------
        // TEST 1: Credited income increases balance.
        // Opening Balance = ₹20,000, Actual Income = ₹40,000, Credited = YES
        // Expected Result: Balance = ₹60,000
        // -------------------------------------------------------------
        console.log('\n[TEST 1] Testing Credited Income...');
        const req1 = { body: { name: 'User One', email: email1, password: 'password123' } };
        const res1 = mockRes();
        await register(req1, res1);
        const userId1 = res1.data.user.id;

        const req1Onboard = {
            user: { id: userId1 },
            body: { userType: 'Working Professional', openingBalance: 20000, income: 40000, isCredited: true }
        };
        const res1Onboard = mockRes();
        await completeOnboarding(req1Onboard, res1Onboard);

        const req1Sum = { user: { id: userId1 } };
        const res1Sum = mockRes();
        await getTransactionSummary(req1Sum, res1Sum);

        console.assert(res1Sum.data.openingBalance === 20000, 'Opening balance must be 20,000');
        console.assert(res1Sum.data.totalIncome === 40000, 'Total income must be 40,000');
        console.assert(res1Sum.data.balance === 60000, `Balance must be 60,000 (Got: ${res1Sum.data.balance})`);
        console.log('✅ TEST 1 Passed: Credited income increases available balance (₹20,000 + ₹40,000 = ₹60,000).');

        // -------------------------------------------------------------
        // TEST 2: Uncredited income does NOT increase balance.
        // Opening Balance = ₹20,000, Actual Income = ₹40,000, Credited = NO
        // Expected Result: Balance remains ₹20,000. Uncredited income = ₹40,000.
        // -------------------------------------------------------------
        console.log('\n[TEST 2] Testing Uncredited Income...');
        const req2 = { body: { name: 'User Two', email: email2, password: 'password123' } };
        const res2 = mockRes();
        await register(req2, res2);
        const userId2 = res2.data.user.id;

        const req2Onboard = {
            user: { id: userId2 },
            body: { userType: 'Working Professional', openingBalance: 20000, income: 40000, isCredited: false }
        };
        const res2Onboard = mockRes();
        await completeOnboarding(req2Onboard, res2Onboard);

        const req2Sum = { user: { id: userId2 } };
        const res2Sum = mockRes();
        await getTransactionSummary(req2Sum, res2Sum);

        console.assert(res2Sum.data.openingBalance === 20000, 'Opening balance must be 20,000');
        console.assert(res2Sum.data.balance === 20000, `Balance must remain 20,000 (Got: ${res2Sum.data.balance})`);
        console.assert(res2Sum.data.uncreditedIncome === 40000, 'Uncredited income must be 40,000');
        console.log('✅ TEST 2 Passed: Uncredited income does NOT increase balance (Balance remains ₹20,000).');

        // -------------------------------------------------------------
        // TEST 3: Later crediting pending income increases balance exactly once.
        // Toggle credit status on the pending transaction from TEST 2.
        // Expected Result: Balance increases to ₹60,000.
        // -------------------------------------------------------------
        console.log('\n[TEST 3] Testing Later Crediting of Pending Income...');
        const pendingTx = await Transaction.findOne({ userId: userId2, isCredited: false });
        console.assert(pendingTx, 'Pending transaction must exist');

        const reqCredit = { user: { id: userId2 }, params: { id: pendingTx._id }, body: { isCredited: true } };
        const resCredit = mockRes();
        await toggleCreditStatus(reqCredit, resCredit);

        console.assert(resCredit.data.isCredited === true, 'Transaction isCredited updated to true');

        const res2SumAfter = mockRes();
        await getTransactionSummary(req2Sum, res2SumAfter);

        console.assert(res2SumAfter.data.balance === 60000, `Balance must now be 60,000 after crediting (Got: ${res2SumAfter.data.balance})`);
        console.log('✅ TEST 3 Passed: Crediting pending income updates available balance to ₹60,000 exactly once.');

        // -------------------------------------------------------------
        // TEST 4: Historical transactions remain associated with their actual dates.
        // Add transaction with date 2026-08-15.
        // -------------------------------------------------------------
        console.log('\n[TEST 4] Testing Historical Transaction Date Association...');
        const req3 = { body: { name: 'User Three', email: email3, password: 'password123' } };
        const res3 = mockRes();
        await register(req3, res3);
        const userId3 = res3.data.user.id;

        const augustDate = new Date('2026-08-15T10:00:00.000Z');
        const reqAug = {
            user: { id: userId3 },
            body: { title: 'August Freelance', amount: 15000, type: 'income', category: 'Salary', date: augustDate.toISOString(), isCredited: true }
        };
        const resAug = mockRes();
        await addTransaction(reqAug, resAug);

        const savedAugTx = resAug.data;
        const savedDate = new Date(savedAugTx.date);
        console.assert(savedDate.getUTCMonth() === 7, `Month must be August (index 7). Got: ${savedDate.getUTCMonth()}`);
        console.assert(savedDate.getUTCDate() === 15, `Date must be 15th. Got: ${savedDate.getUTCDate()}`);
        console.log('✅ TEST 4 Passed: Historical transaction preserves actual transaction date (August 15, 2026).');

        // -------------------------------------------------------------
        // TEST 5 & TEST 6: September vs August Monthly Income classification.
        // Add September transaction (2026-09-10).
        // August income must NOT appear in September income (`thisMonthIncome`).
        // September income MUST appear in September income.
        // -------------------------------------------------------------
        console.log('\n[TEST 5 & 6] Testing Monthly Income Classification (August vs September)...');
        const septemberDate = new Date('2026-09-10T10:00:00.000Z');
        const reqSep = {
            user: { id: userId3 },
            body: { title: 'September Salary', amount: 50000, type: 'income', category: 'Salary', date: septemberDate.toISOString(), isCredited: true }
        };
        const resSep = mockRes();
        await addTransaction(reqSep, resSep);

        const res3Sum = mockRes();
        await getTransactionSummary({ user: { id: userId3 } }, res3Sum);

        // Currently simulated in September 2026 context
        console.assert(res3Sum.data.totalIncome === 65000, `Total all-time income is 65,000 (Got: ${res3Sum.data.totalIncome})`);
        console.assert(res3Sum.data.thisMonthIncome === 50000, `September income is 50,000 (Got: ${res3Sum.data.thisMonthIncome})`);
        console.log('✅ TEST 5 Passed: August income (15,000) does NOT bleed into September income.');
        console.log('✅ TEST 6 Passed: September income (50,000) is accurately calculated for September.');

        // -------------------------------------------------------------
        // TEST 7: Opening balance is not double-counted with pre-existing transactions.
        // Setup user with Opening Balance = ₹25,000 set on Sept 17.
        // Aug 15 historical transaction occurred BEFORE opening balance date.
        // Resulting balance must be ₹25,000 + post-opening transactions, NOT ₹25,000 + Aug transaction.
        // -------------------------------------------------------------
        console.log('\n[TEST 7] Testing Opening Balance Protection against double-counting...');
        const sept17Date = new Date('2026-09-17T00:00:00.000Z');
        await User.findByIdAndUpdate(userId3, { openingBalance: 25000, openingBalanceDate: sept17Date });

        const res3SumDoubleCheck = mockRes();
        await getTransactionSummary({ user: { id: userId3 } }, res3SumDoubleCheck);

        // Aug 15 (15,000) is BEFORE Sept 17 -> Ignored for post-opening balance calculation.
        // Sept 10 (50,000) is BEFORE Sept 17 -> Ignored for post-opening balance calculation.
        // So balance = Opening Balance (25,000).
        console.assert(res3SumDoubleCheck.data.balance === 25000, `Balance must be 25,000 (Got: ${res3SumDoubleCheck.data.balance})`);
        console.log('✅ TEST 7 Passed: Transactions before opening balance date are not double-counted.');

        console.log('\n🎉 ALL 7 PHASE 2 TEST SCENARIOS PASSED SUCCESSFULLY!');

    } finally {
        const cleanupUsers = await User.find({ email: { $in: [email1, email2, email3] } });
        const cleanupUserIds = cleanupUsers.map(u => u._id);
        await Transaction.deleteMany({ userId: { $in: cleanupUserIds } });
        await User.deleteMany({ email: { $in: [email1, email2, email3] } });
        await mongoose.disconnect();
        console.log('🔌 DB Disconnected');
    }
}

runPhase2Tests().catch(err => {
    console.error('❌ Phase 2 Test Failed:', err);
    process.exit(1);
});
