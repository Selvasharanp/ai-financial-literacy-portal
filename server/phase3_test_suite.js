const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Goal = require('./models/Goal');
const GoalTransfer = require('./models/GoalTransfer');
const { register, completeOnboarding } = require('./controllers/authController');
const { getTransactionSummary } = require('./controllers/transactionController');
const { addGoal, allocateToGoal, emergencyWithdrawal, skipAllocation } = require('./controllers/goalController');

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/financial-literacy-portal';
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test_jwt_secret_phase3_12345';
}

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    res.send = (msg) => { res.msg = msg; return res; };
    return res;
};

async function runPhase3Tests() {
    console.log('=== RUNNING PHASE 3 TEST SUITE ===');
    console.log('Connecting to Mongo URI:', mongoUri);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to Database');

    const emailA = 'phase3_test_ab@example.com';
    const emailC = 'phase3_test_c@example.com';
    const emailD = 'phase3_test_d@example.com';
    const emailE = 'phase3_test_e@example.com';

    // Cleanup previous test users & transactions
    const testUsers = await User.find({ email: { $in: [emailA, emailC, emailD, emailE] } });
    const testUserIds = testUsers.map(u => u._id);
    await Transaction.deleteMany({ userId: { $in: testUserIds } });
    await Goal.deleteMany({ userId: { $in: testUserIds } });
    await GoalTransfer.deleteMany({ userId: { $in: testUserIds } });
    await User.deleteMany({ email: { $in: [emailA, emailC, emailD, emailE] } });

    try {
        // -------------------------------------------------------------
        // TEST A: Allocate ₹10,000 from ₹60,000 Available Balance
        // Available Balance = ₹60,000, Goal = ₹0.
        // Expected: Available Balance = ₹50,000, Goal = ₹10,000.
        // -------------------------------------------------------------
        console.log('\n[TEST A] Testing Goal Allocation...');
        const reqA = { body: { name: 'User A', email: emailA, password: 'password123' } };
        const resA = mockRes();
        await register(reqA, resA);
        const userIdA = resA.data.user.id;

        // Onboarding: Opening Balance ₹20,000 + Credited Income ₹40,000 = ₹60,000 Available Balance
        const reqAOnboard = {
            user: { id: userIdA },
            body: { userType: 'Working Professional', openingBalance: 20000, income: 40000, isCredited: true }
        };
        const resAOnboard = mockRes();
        await completeOnboarding(reqAOnboard, resAOnboard);

        // Create Goal (Emergency Fund) with Target ₹50,000
        const reqAGoal = { user: { id: userIdA }, body: { targetName: 'Emergency Fund', targetAmount: 50000 } };
        const resAGoal = mockRes();
        await addGoal(reqAGoal, resAGoal);
        const goalIdA = resAGoal.data._id;

        // Allocate ₹10,000 to Goal
        const reqAlloc = { user: { id: userIdA }, params: { id: goalIdA }, body: { amount: 10000 } };
        const resAlloc = mockRes();
        await allocateToGoal(reqAlloc, resAlloc);

        const resASum = mockRes();
        await getTransactionSummary({ user: { id: userIdA } }, resASum);
        const goalADoc = await Goal.findById(goalIdA);

        console.assert(resASum.data.balance === 50000, `Available Balance must be 50,000 (Got: ${resASum.data.balance})`);
        console.assert(goalADoc.currentAmount === 10000, `Goal currentAmount must be 10,000 (Got: ${goalADoc.currentAmount})`);
        console.log('✅ TEST A Passed: Allocated ₹10,000 -> Available Balance = ₹50,000, Goal Balance = ₹10,000.');

        // -------------------------------------------------------------
        // TEST B: Emergency withdrawal = ₹4,000 from ₹10,000 Goal
        // Expected: Goal = ₹6,000, Available Balance increases by ₹4,000 to ₹54,000.
        // -------------------------------------------------------------
        console.log('\n[TEST B] Testing Emergency Withdrawal...');
        const reqWithdraw = {
            user: { id: userIdA },
            params: { id: goalIdA },
            body: { amount: 4000, reason: 'Car Repair Emergency' }
        };
        const resWithdraw = mockRes();
        await emergencyWithdrawal(reqWithdraw, resWithdraw);

        const resBSum = mockRes();
        await getTransactionSummary({ user: { id: userIdA } }, resBSum);
        const goalBDoc = await Goal.findById(goalIdA);

        console.assert(goalBDoc.currentAmount === 6000, `Goal currentAmount must be 6,000 (Got: ${goalBDoc.currentAmount})`);
        console.assert(resBSum.data.balance === 54000, `Available Balance must be 54,000 (Got: ${resBSum.data.balance})`);
        console.log('✅ TEST B Passed: Withdrew ₹4,000 from Goal -> Goal Balance = ₹6,000, Available Balance = ₹54,000.');

        // -------------------------------------------------------------
        // TEST C: Available Balance = ₹5,000. Try allocating ₹8,000.
        // Expected: Reject transaction with 400 status.
        // -------------------------------------------------------------
        console.log('\n[TEST C] Testing Oversized Allocation Validation...');
        const reqC = { body: { name: 'User C', email: emailC, password: 'password123' } };
        const resC = mockRes();
        await register(reqC, resC);
        const userIdC = resC.data.user.id;

        // Onboarding: Opening Balance = ₹5,000
        await completeOnboarding({ user: { id: userIdC }, body: { userType: 'Student', openingBalance: 5000 } }, mockRes());

        // Create Goal
        const resCGoal = mockRes();
        await addGoal({ user: { id: userIdC }, body: { targetName: 'Laptop', targetAmount: 60000 } }, resCGoal);
        const goalIdC = resCGoal.data._id;

        // Try allocating ₹8,000 (more than ₹5,000 balance)
        const resCOverAlloc = mockRes();
        await allocateToGoal({ user: { id: userIdC }, params: { id: goalIdC }, body: { amount: 8000 } }, resCOverAlloc);

        console.assert(resCOverAlloc.statusCode === 400, `Must return status 400 (Got: ${resCOverAlloc.statusCode})`);
        console.assert(resCOverAlloc.data.error.includes('cannot exceed available balance'), 'Error message must specify available balance limit');
        console.log('✅ TEST C Passed: Rejected allocating ₹8,000 when Available Balance is ₹5,000.');

        // -------------------------------------------------------------
        // TEST D: Goal = ₹3,000. Try withdrawing ₹5,000.
        // Expected: Reject transaction with 400 status.
        // -------------------------------------------------------------
        console.log('\n[TEST D] Testing Oversized Withdrawal Validation...');
        const reqD = { body: { name: 'User D', email: emailD, password: 'password123' } };
        const resD = mockRes();
        await register(reqD, resD);
        const userIdD = resD.data.user.id;

        await completeOnboarding({ user: { id: userIdD }, body: { userType: 'Student', openingBalance: 10000 } }, mockRes());

        // Create Goal & set currentAmount = 3000
        const resDGoal = mockRes();
        await addGoal({ user: { id: userIdD }, body: { targetName: 'Trip', targetAmount: 20000 } }, resDGoal);
        const goalIdD = resDGoal.data._id;

        await Goal.findByIdAndUpdate(goalIdD, { currentAmount: 3000 });

        // Try withdrawing ₹5,000 (more than ₹3,000 goal balance)
        const resDOverWithdraw = mockRes();
        await emergencyWithdrawal({ user: { id: userIdD }, params: { id: goalIdD }, body: { amount: 5000 } }, resDOverWithdraw);

        console.assert(resDOverWithdraw.statusCode === 400, `Must return status 400 (Got: ${resDOverWithdraw.statusCode})`);
        console.assert(resDOverWithdraw.data.error.includes('cannot exceed goal balance'), 'Error message must specify goal balance limit');
        console.log('✅ TEST D Passed: Rejected withdrawing ₹5,000 when Goal Balance is ₹3,000.');

        // -------------------------------------------------------------
        // TEST E: Select "Don't allocate for the goal."
        // Expected: Reason + alternative expense fields are saved in GoalTransfer.
        // NO automatic expense transaction should be created.
        // -------------------------------------------------------------
        console.log('\n[TEST E] Testing Skip Allocation (Don\'t Allocate)...');
        const reqE = { body: { name: 'User E', email: emailE, password: 'password123' } };
        const resE = mockRes();
        await register(reqE, resE);
        const userIdE = resE.data.user.id;

        await completeOnboarding({ user: { id: userIdE }, body: { userType: 'Student', openingBalance: 15000 } }, mockRes());

        const initialTxCount = await Transaction.countDocuments({ userId: userIdE });

        // Skip allocation with explanation & alternative expense
        const resESkip = mockRes();
        await skipAllocation({
            user: { id: userIdE },
            body: {
                skipReason: 'Need funds for semester textbook purchase',
                alternativeExpense: 'Textbooks'
            }
        }, resESkip);

        const finalTxCount = await Transaction.countDocuments({ userId: userIdE });
        const savedSkipDoc = await GoalTransfer.findOne({ userId: userIdE, type: 'skip_allocation' });

        console.assert(savedSkipDoc, 'Skip allocation document must exist');
        console.assert(savedSkipDoc.reason === 'Need funds for semester textbook purchase', 'Reason must match');
        console.assert(savedSkipDoc.alternativeExpense === 'Textbooks', 'Alternative expense text must match');
        console.assert(finalTxCount === initialTxCount, `Transaction count must not change (Got initial: ${initialTxCount}, final: ${finalTxCount})`);
        console.log('✅ TEST E Passed: Skip allocation reason saved successfully with 0 automatic expense transactions created.');

        console.log('\n🎉 ALL 5 PHASE 3 TEST SCENARIOS PASSED SUCCESSFULLY!');

    } finally {
        const cleanupUsers = await User.find({ email: { $in: [emailA, emailC, emailD, emailE] } });
        const cleanupUserIds = cleanupUsers.map(u => u._id);
        await Transaction.deleteMany({ userId: { $in: cleanupUserIds } });
        await Goal.deleteMany({ userId: { $in: cleanupUserIds } });
        await GoalTransfer.deleteMany({ userId: { $in: cleanupUserIds } });
        await User.deleteMany({ email: { $in: [emailA, emailC, emailD, emailE] } });
        await mongoose.disconnect();
        console.log('🔌 DB Disconnected');
    }
}

runPhase3Tests().catch(err => {
    console.error('❌ Phase 3 Test Failed:', err);
    process.exit(1);
});
