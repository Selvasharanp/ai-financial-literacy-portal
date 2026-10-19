const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Goal = require('./models/Goal');
const GoalTransfer = require('./models/GoalTransfer');
const { register, completeOnboarding } = require('./controllers/authController');
const { addTransaction, getTransactionSummary, creditSalaryWithGoalWorkflow } = require('./controllers/transactionController');
const { addGoal, getMonthlyGoalStatus } = require('./controllers/goalController');

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/financial-literacy-portal';
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test_jwt_secret_salary_credit_12345';
}

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    res.send = (msg) => { res.msg = msg; return res; };
    return res;
};

async function runSalaryCreditTests() {
    console.log('=== RUNNING SALARY CREDIT & GOAL WORKFLOW TEST SUITE ===');
    console.log('Connecting to Mongo URI:', mongoUri);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to Database');

    const emailTest = 'salary_credit_user@example.com';

    // Cleanup previous test data
    const existingUsers = await User.find({ email: emailTest });
    const userIds = existingUsers.map(u => u._id);
    await Transaction.deleteMany({ userId: { $in: userIds } });
    await Goal.deleteMany({ userId: { $in: userIds } });
    await GoalTransfer.deleteMany({ userId: { $in: userIds } });
    await User.deleteMany({ email: emailTest });

    try {
        // 1. Register User & Complete Onboarding (Working Professional with Pending Salary)
        console.log('\n[TEST 1] Registering user & onboarding with uncredited income...');
        const resReg = mockRes();
        await register({ body: { name: 'Salary User', email: emailTest, password: 'password123' } }, resReg);
        const userId = resReg.data.user.id;

        // Onboarding: Opening Balance ₹20,000, Actual Income ₹40,000, Credited = false
        await completeOnboarding({
            user: { id: userId },
            body: { userType: 'Working Professional', openingBalance: 20000, income: 40000, isCredited: false }
        }, mockRes());

        // Create Goal (Emergency Fund: ₹50,000 target)
        const resGoal = mockRes();
        await addGoal({ user: { id: userId }, body: { targetName: 'Emergency Fund', targetAmount: 50000 } }, resGoal);
        const goalId = resGoal.data._id;

        // Verify summary returns pending income notification
        const resSum1 = mockRes();
        await getTransactionSummary({ user: { id: userId } }, resSum1);
        console.assert(resSum1.data.pendingIncomes.length === 1, 'Pending incomes list must contain 1 pending income');
        console.assert(resSum1.data.pendingIncomes[0].amount === 40000, 'Pending income amount must be 40,000');
        console.log('✅ TEST 1 Passed: Pending salary appears in pendingIncomes summary array for Dashboard banner!');

        // 2. Test Goal Monthly Status & Recommended Allocation
        console.log('\n[TEST 2] Testing getMonthlyGoalStatus...');
        const resStatus1 = mockRes();
        await getMonthlyGoalStatus({ user: { id: userId } }, resStatus1);
        console.assert(resStatus1.data.hasActiveGoal === true, 'User has active goal');
        console.assert(resStatus1.data.hasAllocatedThisMonth === false, 'Allocation has not been taken yet this month');
        console.assert(resStatus1.data.recommendedAllocation > 0, 'Recommended allocation must be > 0');
        console.log(`✅ TEST 2 Passed: Recommended allocation calculated as ₹${resStatus1.data.recommendedAllocation}.`);

        // 3. Confirm Credit & Allocate to Goal
        console.log('\n[TEST 3] Marking salary as credited & allocating to goal...');
        const pendingTxId = resSum1.data.pendingIncomes[0]._id;
        const resCredit1 = mockRes();
        await creditSalaryWithGoalWorkflow({
            user: { id: userId },
            params: { id: pendingTxId },
            body: { allocateGoal: true, goalId: goalId, customAmount: 5000 }
        }, resCredit1);

        console.assert(resCredit1.data.msg.includes('Salary credited successfully'), 'Response message must indicate successful credit');
        console.assert(resCredit1.data.msg.includes('allocated to your goal'), 'Response message must confirm goal allocation amount & goal name');

        // Verify notification banner disappears (pendingIncomes should be empty)
        const resSum2 = mockRes();
        await getTransactionSummary({ user: { id: userId } }, resSum2);
        console.assert(resSum2.data.pendingIncomes.length === 0, 'Pending incomes list must be empty after crediting');
        console.assert(resSum2.data.uncreditedIncome === 0, 'Uncredited income must be 0 after crediting');

        // Verify Goal balance increased by ₹5,000
        const updatedGoal = await Goal.findById(goalId);
        console.assert(updatedGoal.currentAmount === 5000, `Goal currentAmount must be 5,000 (Got: ${updatedGoal.currentAmount})`);
        console.log('✅ TEST 3 Passed: Salary marked as credited, ₹5,000 allocated to goal, notification removed from Dashboard!');

        // 4. Test "Don't allocate" Checkbox & Reason Recording
        console.log('\n[TEST 4] Testing skip allocation checkbox & reason field...');
        // Add another pending income (Freelance salary)
        const resTx2 = mockRes();
        await addTransaction({
            user: { id: userId },
            body: { title: 'Bonus Salary', amount: 15000, type: 'income', category: 'Salary', isCredited: false }
        }, resTx2);
        const bonusTxId = resTx2.data._id;

        // Credit salary with allocateGoal = false and skipReason
        const resCredit2 = mockRes();
        await creditSalaryWithGoalWorkflow({
            user: { id: userId },
            params: { id: bonusTxId },
            body: { allocateGoal: false, skipReason: 'Medical emergency bill this month' }
        }, resCredit2);

        const skipRecord = await GoalTransfer.findOne({ userId, type: 'skip_allocation' });
        console.assert(skipRecord, 'Skip allocation record must be saved in database');
        console.assert(skipRecord.reason === 'Medical emergency bill this month', 'Skip reason must match input');

        // Verify goal balance was NOT modified by skip
        const goalAfterSkip = await Goal.findById(goalId);
        console.assert(goalAfterSkip.currentAmount === 5000, `Goal currentAmount must remain 5,000 (Got: ${goalAfterSkip.currentAmount})`);
        console.log('✅ TEST 4 Passed: Salary credited with "Don\'t allocate" checkbox ticked. Reason saved, goal balance unchanged.');

        // 5. Test Next Month Carry-Over Catch-Up Increase
        console.log('\n[TEST 5] Testing Next Month Carry-Over Catch-Up Allocation Increase...');
        // Simulate a past month skip record
        await new GoalTransfer({
            userId,
            goalId,
            type: 'skip_allocation',
            amount: 0,
            reason: 'Previous month repair bill',
            date: new Date(Date.now() - 35 * 86400000) // 35 days ago (previous month)
        }).save();

        const resStatus2 = mockRes();
        await getMonthlyGoalStatus({ user: { id: userId } }, resStatus2);
        console.assert(resStatus2.data.pastSkipsCount > 0, 'Past skips count must be > 0');
        console.assert(resStatus2.data.recommendedAllocation > resStatus2.data.baseAllocation, 'Recommended allocation must be higher than base allocation due to skipped month');
        console.log(`✅ TEST 5 Passed: Catch-Up allocation for next month increased to ₹${resStatus2.data.recommendedAllocation} (Base: ₹${resStatus2.data.baseAllocation}).`);

        // 6. Test Salary Credit when NO Goal exists & user chooses YES to create goal
        console.log('\n[TEST 6] Testing Salary Credit when NO goal exists & user selects "Yes, create goal"...');
        // Delete all goals for user to simulate fresh user without goal
        await Goal.deleteMany({ userId });

        const resTx3 = mockRes();
        await addTransaction({
            user: { id: userId },
            body: { title: 'Next Month Salary', amount: 45000, type: 'income', category: 'Salary', isCredited: false }
        }, resTx3);
        const nextTxId = resTx3.data._id;

        const resCredit3 = mockRes();
        await creditSalaryWithGoalWorkflow({
            user: { id: userId },
            params: { id: nextTxId },
            body: {
                createNewGoal: true,
                newGoalData: { targetName: 'New Car Fund', targetAmount: 200000 },
                customAmount: 8000
            }
        }, resCredit3);

        const newCreatedGoal = await Goal.findOne({ userId, targetName: 'New Car Fund' });
        console.assert(newCreatedGoal, 'New goal must be created in database');
        console.assert(newCreatedGoal.currentAmount === 8000, `New goal initial allocation must be 8,000 (Got: ${newCreatedGoal.currentAmount})`);
        console.assert(resCredit3.data.msg.includes('New goal "New Car Fund" created'), 'Response msg must acknowledge new goal creation');
        console.log('✅ TEST 6 Passed: Salary credited and new goal "New Car Fund" created on the fly with ₹8,000 allocated!');

        // 7. Test Salary Credit when NO Goal exists & user chooses NO
        console.log('\n[TEST 7] Testing Salary Credit when NO goal exists & user selects "No, credit full salary"...');
        await Goal.deleteMany({ userId }); // Remove goals again

        const resTx4 = mockRes();
        await addTransaction({
            user: { id: userId },
            body: { title: 'Side Hustle Income', amount: 10000, type: 'income', category: 'Freelance', isCredited: false }
        }, resTx4);
        const sideTxId = resTx4.data._id;

        const resCredit4 = mockRes();
        await creditSalaryWithGoalWorkflow({
            user: { id: userId },
            params: { id: sideTxId },
            body: { createNewGoal: false, allocateGoal: false }
        }, resCredit4);

        const goalCountAfterNo = await Goal.countDocuments({ userId });
        console.assert(goalCountAfterNo === 0, 'No goals should be created when user selects No');
        console.assert(resCredit4.data.msg.includes('Full amount added to your Available Balance'), 'Response msg must confirm full salary added to balance');
        console.log('✅ TEST 7 Passed: User selected NO to goal creation; full salary credited directly to Available Balance with 0 goals created!');

        console.log('\n🎉 ALL SALARY CREDIT & GOAL WORKFLOW TESTS PASSED SUCCESSFULLY!');


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

runSalaryCreditTests().catch(err => {
    console.error('❌ Salary Credit Test Failed:', err);
    process.exit(1);
});
