const assert = require('assert');

// Mock User & Transaction logic testing
function calculateSummary(user, transactions, now = new Date()) {
    const openingBalance = user?.openingBalance || 0;

    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0);

    const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);

    const balance = openingBalance + totalIncome - totalExpenses;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

    const thisMonthIncome = transactions
        .filter(t => t.type === 'income' && new Date(t.date) >= monthStart && new Date(t.date) < nextMonthStart)
        .reduce((acc, t) => acc + t.amount, 0);

    const thisMonthExpenses = transactions
        .filter(t => t.type === 'expense' && new Date(t.date) >= monthStart && new Date(t.date) < nextMonthStart)
        .reduce((acc, t) => acc + t.amount, 0);

    return {
        openingBalance,
        openingBalanceDate: user?.openingBalanceDate,
        totalIncome,
        totalExpenses,
        balance,
        thisMonthIncome,
        thisMonthExpenses
    };
}

function runUnitTests() {
    console.log('--- RUNNING UNIT TESTS FOR FINANCIAL TRACKING LOGIC ---');
    const now = new Date('2026-09-17T12:00:00Z');

    // TEST 1 & 2: User Onboarding Profile Structure
    const studentUser = {
        userType: 'Student',
        openingBalance: 12500,
        openingBalanceDate: new Date('2026-09-17'),
        location: 'Chennai'
    };
    const proUser = {
        userType: 'Working Professional',
        openingBalance: 50000,
        openingBalanceDate: new Date('2026-09-01'),
        location: 'Bengaluru'
    };

    assert.strictEqual(studentUser.userType, 'Student');
    assert.strictEqual(proUser.userType, 'Working Professional');
    console.log('✅ TEST 1 & 2 Passed: User profiles created with valid userType');

    // TEST 3: Initial Summary - Opening balance must NOT appear as monthly income
    let transactions = [];
    let summary = calculateSummary(studentUser, transactions, now);
    assert.strictEqual(summary.openingBalance, 12500);
    assert.strictEqual(summary.balance, 12500);
    assert.strictEqual(summary.thisMonthIncome, 0, 'Opening balance is NOT monthly income');
    assert.strictEqual(summary.thisMonthExpenses, 0);
    console.log('✅ TEST 3 Passed: Opening balance separated from monthly income');

    // TEST 4: Add salary income (₹30,000 on Sept 18)
    transactions.push({ type: 'income', amount: 30000, date: new Date('2026-09-18') });
    summary = calculateSummary(studentUser, transactions, now);
    assert.strictEqual(summary.balance, 42500, 'Available balance = 12500 + 30000 = 42500');
    assert.strictEqual(summary.thisMonthIncome, 30000);
    console.log('✅ TEST 4 Passed: Income increases available balance and thisMonthIncome');

    // TEST 5: Add another income (₹5,000 freelance on Sept 20)
    transactions.push({ type: 'income', amount: 5000, date: new Date('2026-09-20') });
    summary = calculateSummary(studentUser, transactions, now);
    assert.strictEqual(summary.balance, 47500);
    assert.strictEqual(summary.thisMonthIncome, 35000);
    console.log('✅ TEST 5 Passed: Multiple incomes accumulate correctly in thisMonthIncome');

    // TEST 6: Add expense (₹500 Food on Sept 18)
    transactions.push({ type: 'expense', amount: 500, date: new Date('2026-09-18') });
    summary = calculateSummary(studentUser, transactions, now);
    assert.strictEqual(summary.balance, 47000);
    assert.strictEqual(summary.thisMonthExpenses, 500);
    console.log('✅ TEST 6 Passed: Expense reduces available balance and increases thisMonthExpenses');

    // TEST 7: Add an expense with an older transaction date (August 15)
    transactions.push({ type: 'expense', amount: 1000, date: new Date('2026-08-15') });
    summary = calculateSummary(studentUser, transactions, now);
    assert.strictEqual(summary.balance, 46000, 'Balance accounts for historical expenses');
    assert.strictEqual(summary.thisMonthExpenses, 500, 'thisMonthExpenses excludes August expense');
    console.log('✅ TEST 7 Passed: Historical expense correctly isolated from current month expenses');

    // TEST 8: Add income from a previous month (August 10)
    transactions.push({ type: 'income', amount: 10000, date: new Date('2026-08-10') });
    summary = calculateSummary(studentUser, transactions, now);
    assert.strictEqual(summary.balance, 56000);
    assert.strictEqual(summary.thisMonthIncome, 35000, 'thisMonthIncome excludes August income');
    console.log('✅ TEST 8 Passed: Historical income correctly isolated from current month income');

    // TEST 9: Automatic month roll (simulate October 2026)
    const octNow = new Date('2026-10-05T12:00:00Z');
    summary = calculateSummary(studentUser, transactions, octNow);
    assert.strictEqual(summary.balance, 56000, 'Total available balance remains 56000');
    assert.strictEqual(summary.thisMonthIncome, 0, 'In October, Sept incomes are not in thisMonthIncome');
    assert.strictEqual(summary.thisMonthExpenses, 0, 'In October, Sept expenses are not in thisMonthExpenses');
    console.log('✅ TEST 9 Passed: Month calculations roll automatically based on transaction date');

    console.log('\n🎉 ALL UNIT TEST SCENARIOS PASSED SUCCESSFULLY!');
}

runUnitTests();
