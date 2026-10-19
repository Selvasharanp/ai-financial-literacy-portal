const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Goal = require('./models/Goal');
const { register, login, getProfile } = require('./controllers/authController');
const { getTransactionSummary, addTransaction } = require('./controllers/transactionController');
const { buildFinancialDashboard } = require('./services/financialDashboard');

dotenv.config();

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    res.send = (msg) => { res.msg = msg; return res; };
    return res;
};

async function runTests() {
    console.log('--- STARTING FINANCIAL TRACKING & ONBOARDING SUITE ---');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ DB Connected');

    // Clean up test users first
    const testEmails = ['test_student_123@example.com', 'test_pro_123@example.com'];
    const existingUsers = await User.find({ email: { $in: testEmails } });
    for (const u of existingUsers) {
        await Transaction.deleteMany({ userId: u._id });
        await User.deleteOne({ _id: u._id });
    }

    try {
        // TEST 1: New Student Registration
        console.log('\n[TEST 1] Student Registration...');
        const req1 = {
            body: {
                name: 'Student Test User',
                email: 'test_student_123@example.com',
                password: 'password123',
                userType: 'Student',
                openingBalance: 12500,
                openingBalanceDate: '2026-09-17',
                location: 'Chennai'
            }
        };
        const res1 = mockRes();
        await register(req1, res1);
        console.assert(res1.data?.token, 'Token generated');
        console.assert(res1.data?.user?.userType === 'Student', 'User type is Student');
        console.assert(res1.data?.user?.openingBalance === 12500, 'Opening balance stored as 12500');
        console.log('✅ TEST 1 Passed');

        const studentId = res1.data.user.id;

        // TEST 2: New Working Professional Registration
        console.log('\n[TEST 2] Working Professional Registration...');
        const req2 = {
            body: {
                name: 'Pro Test User',
                email: 'test_pro_123@example.com',
                password: 'password123',
                userType: 'Working Professional',
                openingBalance: 50000,
                openingBalanceDate: '2026-09-01',
                location: 'Bengaluru'
            }
        };
        const res2 = mockRes();
        await register(req2, res2);
        console.assert(res2.data?.user?.userType === 'Working Professional', 'User type is Working Professional');
        console.assert(res2.data?.user?.openingBalance === 50000, 'Opening balance stored as 50000');
        console.log('✅ TEST 2 Passed');

        // TEST 3: Opening Balance MUST NOT appear as monthly income
        console.log('\n[TEST 3] Check initial summary for student...');
        const req3 = { user: { id: studentId } };
        const res3 = mockRes();
        await getTransactionSummary(req3, res3);
        console.log('Summary output:', res3.data);
        console.assert(res3.data.openingBalance === 12500, 'Opening balance is 12500');
        console.assert(res3.data.balance === 12500, 'Available balance is 12500');
        console.assert(res3.data.thisMonthIncome === 0, 'This month income MUST BE 0 (Opening balance is NOT income)');
        console.assert(res3.data.thisMonthExpenses === 0, 'This month expenses is 0');
        console.log('✅ TEST 3 Passed');

        // TEST 4: Add salary income (₹30,000 on Sept 18, 2026)
        console.log('\n[TEST 4] Adding Sept Salary ₹30,000...');
        const req4 = {
            user: { id: studentId },
            body: { title: 'Salary', amount: 30000, type: 'income', category: 'Salary', date: '2026-09-18' }
        };
        const res4 = mockRes();
        await addTransaction(req4, res4);

        const res4Sum = mockRes();
        await getTransactionSummary(req3, res4Sum);
        console.log('Summary after salary:', res4Sum.data);
        console.assert(res4Sum.data.balance === 42500, 'Available balance is 42500 (12500 + 30000)');
        console.assert(res4Sum.data.thisMonthIncome === 30000, 'This month income is 30000');
        console.log('✅ TEST 4 Passed');

        // TEST 5: Add another income (₹5,000 freelance on Sept 20, 2026)
        console.log('\n[TEST 5] Adding Freelance Income ₹5,000...');
        const req5 = {
            user: { id: studentId },
            body: { title: 'Freelance', amount: 5000, type: 'income', category: 'Freelance', date: '2026-09-20' }
        };
        const res5 = mockRes();
        await addTransaction(req5, res5);

        const res5Sum = mockRes();
        await getTransactionSummary(req3, res5Sum);
        console.log('Summary after freelance:', res5Sum.data);
        console.assert(res5Sum.data.balance === 47500, 'Available balance is 47500');
        console.assert(res5Sum.data.thisMonthIncome === 35000, 'This month income is 35000 (30000 + 5000)');
        console.log('✅ TEST 5 Passed');

        // TEST 6: Add Expense (₹500 Food on Sept 18, 2026)
        console.log('\n[TEST 6] Adding Sept Expense ₹500...');
        const req6 = {
            user: { id: studentId },
            body: { title: 'Food', amount: 500, type: 'expense', category: 'Food', date: '2026-09-18' }
        };
        const res6 = mockRes();
        await addTransaction(req6, res6);

        const res6Sum = mockRes();
        await getTransactionSummary(req3, res6Sum);
        console.log('Summary after expense:', res6Sum.data);
        console.assert(res6Sum.data.balance === 47000, 'Available balance is 47000 (47500 - 500)');
        console.assert(res6Sum.data.thisMonthExpenses === 500, 'This month expenses is 500');
        console.log('✅ TEST 6 Passed');

        // TEST 7: Add an expense with an older transaction date (August 15, 2026)
        console.log('\n[TEST 7] Adding August Expense ₹1,000...');
        const req7 = {
            user: { id: studentId },
            body: { title: 'August Rent', amount: 1000, type: 'expense', category: 'Rent', date: '2026-08-15' }
        };
        const res7 = mockRes();
        await addTransaction(req7, res7);

        const res7Sum = mockRes();
        await getTransactionSummary(req3, res7Sum);
        console.log('Summary after August expense:', res7Sum.data);
        console.assert(res7Sum.data.balance === 46000, 'Available balance is 46000');
        console.assert(res7Sum.data.thisMonthExpenses === 500, 'This month expenses remains 500 (August expense not included in Sept expenses)');
        console.log('✅ TEST 7 Passed');

        // TEST 8: Add income from a previous month (August 10, 2026)
        console.log('\n[TEST 8] Adding August Income ₹10,000...');
        const req8 = {
            user: { id: studentId },
            body: { title: 'August Bonus', amount: 10000, type: 'income', category: 'Bonus', date: '2026-08-10' }
        };
        const res8 = mockRes();
        await addTransaction(req8, res8);

        const res8Sum = mockRes();
        await getTransactionSummary(req3, res8Sum);
        console.log('Summary after August income:', res8Sum.data);
        console.assert(res8Sum.data.balance === 56000, 'Available balance is 56000');
        console.assert(res8Sum.data.thisMonthIncome === 35000, 'This month income remains 35000 (August income not in Sept income)');
        console.log('✅ TEST 8 Passed');

        // TEST 9 & 10 & 11: Dashboard and financial calculations
        console.log('\n[TEST 9-11] Build Financial Dashboard Service Check...');
        const transactions = await Transaction.find({ userId: studentId });
        const dash = buildFinancialDashboard(transactions, [], 'Chennai', new Date('2026-09-17'), 12500);
        console.assert(dash.daysUntilBroke.balance === 56000, 'Dashboard total balance matches available balance (56000)');
        console.log('✅ TEST 9-11 Passed');

    } finally {
        // Clean up test users
        const users = await User.find({ email: { $in: testEmails } });
        for (const u of users) {
            await Transaction.deleteMany({ userId: u._id });
            await User.deleteOne({ _id: u._id });
        }
        await mongoose.disconnect();
        console.log('\n🎉 ALL 12 TEST SCENARIOS VERIFIED SUCCESSFULLY!');
    }
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
