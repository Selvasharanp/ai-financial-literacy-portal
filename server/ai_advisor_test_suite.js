const { analyzeTransactions } = require('./services/insightEngine');

console.log('=====================================================');
console.log('=== PHASE 1: AI ADVISOR CONTEXT-AWARE TEST SUITE ===');
console.log('=====================================================\n');

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

// Fixed baseline reference date for deterministic testing: 18th of current month
const now = new Date();
now.setDate(18);

// ----------------------------------------------------
// TEST 1 — Healthy Spending
// Income = ₹40,000, Expenses = ₹20,000, Goal contribution = ₹5,000
// ----------------------------------------------------
console.log('[TEST 1] Healthy Spending scenario...');
const test1Transactions = [
    { type: 'income', amount: 40000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { type: 'expense', title: 'Rent & Bills', category: 'Bills', amount: 15000, date: new Date(now.getFullYear(), now.getMonth(), 5) },
    { type: 'expense', title: 'Groceries', category: 'Food', amount: 5000, date: new Date(now.getFullYear(), now.getMonth(), 10) }
];
const test1Goals = [
    { targetName: 'Emergency Fund', targetAmount: 100000, currentAmount: 5000, status: 'active', createdAt: new Date(now.getFullYear(), now.getMonth(), 1) }
];
const result1 = analyzeTransactions(test1Transactions, test1Goals, now, 0);

const hasSmallSavingsWarning = result1.alerts.some(a => a.title.toLowerCase().includes('saving contribution is still small') || a.title.toLowerCase().includes('low-savings'));
const hasHealthyOrManageable = result1.alerts.some(a => a.tag === 'spending-under-control' || a.tag === 'manageable-month-pace');

assert(!hasSmallSavingsWarning, 'Must NOT contain hardcoded negative "saving contribution is still small" warning.');
assert(hasHealthyOrManageable || result1.health.isManageableMonth, 'Must recognize healthy spending / manageable spending pace.');


// ----------------------------------------------------
// TEST 2 — High Spending
// Income = ₹40,000, Expenses = ₹37,000, Goal contribution = ₹1,000
// ----------------------------------------------------
console.log('\n[TEST 2] High Spending scenario...');
const test2Transactions = [
    { type: 'income', amount: 40000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { type: 'expense', title: 'Major Expense', category: 'Shopping', amount: 37000, date: new Date(now.getFullYear(), now.getMonth(), 5) }
];
const test2Goals = [
    { targetName: 'Buy Laptop', targetAmount: 80000, currentAmount: 1000, status: 'active', createdAt: new Date(now.getFullYear(), now.getMonth(), 1) }
];
const result2 = analyzeTransactions(test2Transactions, test2Goals, now, 0);

const highSpendingAlert = result2.alerts.find(a => a.tag === 'high-expense-ratio' || a.type === 'budget-adherence');
const criticizedGoal = result2.alerts.some(a => a.title.toLowerCase().includes('goal contribution is too small'));

assert(!!highSpendingAlert, 'Advisor must focus on high expense ratio / spending pressure when expenses take 92.5% of income.');
assert(!criticizedGoal, 'Advisor must NOT blame or criticize the goal contribution amount.');


// ----------------------------------------------------
// TEST 3 — New Goal
// New goal created + first contribution
// ----------------------------------------------------
console.log('\n[TEST 3] New Goal scenario...');
const test3Transactions = [
    { type: 'income', amount: 30000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { type: 'expense', title: 'Living Costs', category: 'Bills', amount: 10000, date: new Date(now.getFullYear(), now.getMonth(), 5) }
];
const test3Goals = [
    { targetName: 'New Bike', targetAmount: 60000, currentAmount: 2000, status: 'active', createdAt: new Date() }
];
const result3 = analyzeTransactions(test3Transactions, test3Goals, now, 0);

const newGoalSupport = result3.alerts.find(a => a.tag === 'new-goal-encouragement');
const criticizedNewGoal = result3.alerts.some(a => a.tag === 'low-savings');

assert(!!newGoalSupport, 'Advisor must encourage newly created goal with habit-building guidance.');
assert(!criticizedNewGoal, 'Advisor must NOT criticize first contribution on a new goal.');


// ----------------------------------------------------
// TEST 4 — Consistent Monthly Contribution
// Regular monthly goal transfers across several months
// ----------------------------------------------------
console.log('\n[TEST 4] Consistent Monthly Contribution scenario...');
const test4Transactions = [
    { type: 'income', amount: 50000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { type: 'expense', title: 'Essentials', category: 'General', amount: 15000, date: new Date(now.getFullYear(), now.getMonth(), 5) }
];
const test4Goals = [
    { targetName: 'Home Deposit', targetAmount: 300000, currentAmount: 15000, status: 'active', createdAt: new Date(now.getFullYear(), now.getMonth() - 3, 1) }
];
const result4 = analyzeTransactions(test4Transactions, test4Goals, now, 0);

const consistentGoalAlert = result4.alerts.find(a => a.tag === 'consistent-goal-progress' || a.tag === 'new-goal-encouragement');
assert(!!consistentGoalAlert, 'Advisor must recognize consistent monthly goal progress.');


// ----------------------------------------------------
// TEST 5 — Spending Spike
// Sudden unusually large spending on a single day
// ----------------------------------------------------
console.log('\n[TEST 5] Spending Spike scenario...');
const test5Transactions = [
    { type: 'income', amount: 50000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { type: 'expense', title: 'Small Item 1', category: 'General', amount: 300, date: new Date(now.getFullYear(), now.getMonth(), 2) },
    { type: 'expense', title: 'Small Item 2', category: 'General', amount: 400, date: new Date(now.getFullYear(), now.getMonth(), 5) },
    { type: 'expense', title: 'Small Item 3', category: 'General', amount: 350, date: new Date(now.getFullYear(), now.getMonth(), 10) },
    { type: 'expense', title: 'Huge Spending Spike', category: 'Electronics', amount: 8000, date: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
];
const result5 = analyzeTransactions(test5Transactions, [], now, 0);

const spikeAlert = result5.alerts.find(a => a.tag === 'spending-spike');
assert(!!spikeAlert, 'Advisor must identify sudden unusually large daily spending spike.');


// ----------------------------------------------------
// TEST 6 — Manageable Remaining Month
// Available balance relative to recent spending rate & remaining days
// ----------------------------------------------------
console.log('\n[TEST 6] Manageable Remaining Month scenario...');
const test6Transactions = [
    { type: 'income', amount: 40000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { type: 'expense', title: 'Expenses to date', category: 'General', amount: 10000, date: new Date(now.getFullYear(), now.getMonth(), 10) }
];
// Balance = ₹30,000, Elapsed = 18 days, Daily Avg = 10000/18 = ₹555/day. Remaining = 12 days * 555 = ₹6,666. Balance ₹30,000 > ₹6,666!
const result6 = analyzeTransactions(test6Transactions, [], now, 0);

assert(result6.health.isManageableMonth === true, 'isManageableMonth must be true when balance > estimated remaining spend.');
const manageableAlert = result6.alerts.find(a => a.tag === 'manageable-month-pace' || a.tag === 'spending-under-control');
assert(!!manageableAlert, 'Advisor must explicitly inform user that current spending pace looks manageable for remaining days.');


console.log('\n=====================================================');
console.log(`=== TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED ===`);
console.log('=====================================================\n');

if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 1 AI ADVISOR TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
} else {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
}
