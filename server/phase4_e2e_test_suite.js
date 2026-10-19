const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Goal = require('./models/Goal');
const GoalTransfer = require('./models/GoalTransfer');
const { register, login, completeOnboarding } = require('./controllers/authController');
const { getTransactionSummary } = require('./controllers/transactionController');
const { addGoal, allocateToGoal, emergencyWithdrawal } = require('./controllers/goalController');

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/financial-literacy-portal';
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test_jwt_secret_phase4_e2e_98765';
}

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    res.send = (msg) => { res.msg = msg; return res; };
    return res;
};

async function runPhase4E2ETests() {
    console.log('====================================================');
    console.log('=== PHASE 4: FINAL END-TO-END INTEGRATION SUITE ===');
    console.log('====================================================');
    console.log('Connecting to Mongo URI:', mongoUri);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to Database');

    const emailTest = 'phase4_e2e_user@example.com';

    // Cleanup previous test data
    const existingUsers = await User.find({ email: emailTest });
    const userIds = existingUsers.map(u => u._id);
    await Transaction.deleteMany({ userId: { $in: userIds } });
    await Goal.deleteMany({ userId: { $in: userIds } });
    await GoalTransfer.deleteMany({ userId: { $in: userIds } });
    await User.deleteMany({ email: emailTest });

    try {
        // Step 1: Register User -> Automatic Auth Token / User object returned
        console.log('\n[STEP 1] Registering user & automatic login...');
        const resReg = mockRes();
        await register({ body: { name: 'Phase4 User', email: emailTest, password: 'password123' } }, resReg);
        console.assert(resReg.data.token, 'Auth token must be generated upon registration');
        console.assert(resReg.data.user.hasCompletedOnboarding === false, 'New user has not completed onboarding');
        const userId = resReg.data.user.id;
        console.log('✅ STEP 1 Passed: User registered & automatically authenticated.');

        // Step 2: Complete Onboarding as Working Professional
        // Opening Balance = ₹20,000, Income = ₹40,000 (Credited = YES)
        console.log('\n[STEP 2] Completing onboarding (Opening Balance ₹20,000, Income ₹40,000, Credited = YES)...');
        await completeOnboarding({
            user: { id: userId },
            body: { userType: 'Working Professional', openingBalance: 20000, income: 40000, isCredited: true }
        }, mockRes());

        const resSumOnb = mockRes();
        await getTransactionSummary({ user: { id: userId } }, resSumOnb);
        console.assert(resSumOnb.data.balance === 60000, `Available Balance must be 60,000 (Got: ${resSumOnb.data.balance})`);
        console.log('✅ STEP 2 Passed: Available Balance = ₹60,000.');

        // Step 3: Create Goal (Target ₹50,000)
        console.log('\n[STEP 3] Creating Goal "Emergency Fund" (Target: ₹50,000)...');
        const resGoal = mockRes();
        await addGoal({ user: { id: userId }, body: { targetName: 'Emergency Fund', targetAmount: 50000 } }, resGoal);
        const goalId = resGoal.data._id;
        console.assert(resGoal.data.currentAmount === 0, 'Initial goal currentAmount must be 0');
        console.log('✅ STEP 3 Passed: Goal created successfully.');

        // Step 4: Allocate ₹10,000 to Goal
        console.log('\n[STEP 4] Allocating ₹10,000 to Goal...');
        const resAlloc = mockRes();
        await allocateToGoal({
            user: { id: userId },
            params: { id: goalId },
            body: { amount: 10000 }
        }, resAlloc);
        console.assert(resAlloc.data.goal.currentAmount === 10000, `Goal balance must be 10,000 (Got: ${resAlloc.data.goal.currentAmount})`);
        console.assert(resAlloc.data.availableBalance === 50000, `Available balance after allocation must be 50,000 (Got: ${resAlloc.data.availableBalance})`);
        console.log('✅ STEP 4 Passed: Available Balance = ₹50,000, Goal Balance = ₹10,000.');

        // Step 5: Emergency Withdrawal ₹3,000
        console.log('\n[STEP 5] Emergency Withdrawal of ₹3,000 from Goal...');
        const resWithd = mockRes();
        await emergencyWithdrawal({
            user: { id: userId },
            params: { id: goalId },
            body: { amount: 3000, reason: 'Car tyre replacement' }
        }, resWithd);
        console.assert(resWithd.data.goal.currentAmount === 7000, `Goal balance must be 7,000 after withdrawal (Got: ${resWithd.data.goal.currentAmount})`);
        
        const resSumWithd = mockRes();
        await getTransactionSummary({ user: { id: userId } }, resSumWithd);
        console.assert(resSumWithd.data.balance === 53000, `Available balance must be 53,000 after emergency withdrawal (Got: ${resSumWithd.data.balance})`);
        console.log('✅ STEP 5 Passed: Goal Balance = ₹7,000, Available Balance = ₹53,000.');

        // Step 6: Logout & Re-login -> Fetch Dashboard Summary directly
        console.log('\n[STEP 6] Testing Logout -> Re-login flow...');
        const resLogin = mockRes();
        await login({ body: { email: emailTest, password: 'password123' } }, resLogin);
        console.assert(resLogin.data.token, 'Login must return valid JWT token');
        console.assert(resLogin.data.user.hasCompletedOnboarding === true, 'User onboarding status must be true');

        const resSum = mockRes();
        await getTransactionSummary({ user: { id: userId } }, resSum);
        const s = resSum.data;

        console.log('\n--- VERIFYING FINANCIAL ACCOUNTING METRICS ---');
        console.log('Available Balance:', s.balance);
        console.log('This Month Income:', s.thisMonthIncome);
        console.log('This Month Expenses:', s.thisMonthExpenses);
        console.log('This Month Balance:', s.thisMonthBalance);
        console.log('Active Goal Current Amount:', s.activeGoal?.currentAmount);
        console.log('Date Metrics:', s.dateMetrics);

        // Assertions for exact correctness
        console.assert(s.balance === 53000, `Final Available Balance must be 53,000 (Got: ${s.balance})`);
        console.assert(s.thisMonthIncome === 40000, `Monthly Income must be 40,000 (Got: ${s.thisMonthIncome})`);
        console.assert(s.thisMonthExpenses === 0, `Monthly Expenses must be 0 (Got: ${s.thisMonthExpenses})`);
        console.assert(s.thisMonthBalance === 40000, `Monthly Balance must be 40,000 (Got: ${s.thisMonthBalance})`);
        console.assert(s.activeGoal.currentAmount === 7000, `Active Goal Savings must be 7,000 (Got: ${s.activeGoal.currentAmount})`);
        console.assert(s.uncreditedIncome === 0, 'Uncredited income must be 0');
        console.assert(s.dateMetrics && s.dateMetrics.currentMonth, 'Date metrics must contain currentMonth');

        console.log('✅ STEP 6 Passed: Accounting metrics verified perfectly with zero double-counting!');

        console.log('\n🎉 ALL PHASE 4 END-TO-END SCENARIO TESTS PASSED SUCCESSFULLY!');

    } finally {
        const cleanupUsers = await User.find({ email: emailTest });
        const cleanupIds = cleanupUsers.map(u => u._id);
        await Transaction.deleteMany({ userId: { $in: cleanupIds } });
        await Goal.deleteMany({ userId: { $in: cleanupIds } });
        await GoalTransfer.deleteMany({ userId: { $in: cleanupIds } });
        await User.deleteMany({ email: emailTest });
        await mongoose.disconnect();
        console.log('🔌 DB Disconnected');
    }
}

runPhase4E2ETests().catch(err => {
    console.error('❌ Phase 4 E2E Test Failed:', err);
    process.exit(1);
});
