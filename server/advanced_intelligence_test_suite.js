const { analyzeTransactions } = require('./services/insightEngine');

console.log('================================================================');
console.log('=== PHASE 3: ADVANCED FINANCIAL INTELLIGENCE TEST SUITE ===');
console.log('================================================================\n');

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

// Baseline reference date: 18th of current month
const now = new Date();
now.setDate(18);

// ----------------------------------------------------
// SCENARIO A — Healthy Month
// Healthy spending + sufficient balance + goal contribution
// ----------------------------------------------------
console.log('[SCENARIO A] Healthy Month...');
const transactionsA = [
    { type: 'income', amount: 50000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { type: 'expense', title: 'Rent', category: 'Bills', amount: 15000, date: new Date(now.getFullYear(), now.getMonth(), 5) },
    { type: 'expense', title: 'Groceries', category: 'Food', amount: 5000, date: new Date(now.getFullYear(), now.getMonth(), 10) }
];
const goalsA = [
    { targetName: 'Emergency Savings', targetAmount: 100000, currentAmount: 10000, status: 'active', createdAt: new Date(now.getFullYear(), now.getMonth(), 1) }
];
const resA = analyzeTransactions(transactionsA, goalsA, now, 10000);

const highAlertsA = resA.alerts.filter(a => a.priority === 'HIGH');
assert(highAlertsA.length === 0, 'No high priority alerts for healthy month.');
assert(resA.alerts.some(a => a.tag === 'spending-under-control' || a.tag === 'manageable-month-pace'), 'Positive/neutral healthy spending advice issued.');


// ----------------------------------------------------
// SCENARIO B — Overspending
// Expenses unusually high relative to income (92% used)
// ----------------------------------------------------
console.log('\n[SCENARIO B] Overspending...');
const transactionsB = [
    { type: 'income', amount: 40000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { type: 'expense', title: 'Huge Purchases', category: 'Shopping', amount: 37000, date: new Date(now.getFullYear(), now.getMonth(), 5) }
];
const resB = analyzeTransactions(transactionsB, [], now, 0);

const highExpenseAlert = resB.alerts.find(a => a.tag === 'high-expense-ratio');
assert(!!highExpenseAlert, 'Generates spending-focused warning when expenses consume 92.5% of income.');
assert(highExpenseAlert.priority === 'HIGH', 'High expense ratio is classified as HIGH priority.');


// ----------------------------------------------------
// SCENARIO C — Spending Velocity Increase
// Recent 7-day spending pace significantly higher than previous pace
// ----------------------------------------------------
console.log('\n[SCENARIO C] Spending Velocity Increase...');
const transactionsC = [
    { type: 'income', amount: 60000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    // Earlier pace: ~₹300/day
    { type: 'expense', title: 'Early Expense 1', category: 'General', amount: 1500, date: new Date(now.getFullYear(), now.getMonth(), 2) },
    { type: 'expense', title: 'Early Expense 2', category: 'General', amount: 1500, date: new Date(now.getFullYear(), now.getMonth(), 5) },
    // Recent 7-day pace: ~₹1,500/day (Surge!)
    { type: 'expense', title: 'Surge Expense 1', category: 'Shopping', amount: 4000, date: new Date(now.getFullYear(), now.getMonth(), 13) },
    { type: 'expense', title: 'Surge Expense 2', category: 'Entertainment', amount: 5000, date: new Date(now.getFullYear(), now.getMonth(), 16) }
];
const resC = analyzeTransactions(transactionsC, [], now, 0);

const velocityAlert = resC.alerts.find(a => a.tag === 'spending-velocity-surge');
assert(!!velocityAlert, 'Identifies spending velocity acceleration.');
assert(velocityAlert.whatHappened.includes('/day'), 'Spending velocity insight includes exact daily velocity figures in INR.');


// ----------------------------------------------------
// SCENARIO D — Spending Spike
// Large unusual category expense today
// ----------------------------------------------------
console.log('\n[SCENARIO D] Spending Spike...');
const toDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayDate = new Date(now);

const transactionsD = [
    { type: 'income', amount: 50000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { type: 'expense', title: 'Day 2 spend', category: 'General', amount: 300, date: new Date(now.getFullYear(), now.getMonth(), 2) },
    { type: 'expense', title: 'Day 5 spend', category: 'General', amount: 400, date: new Date(now.getFullYear(), now.getMonth(), 5) },
    { type: 'expense', title: 'Day 10 spend', category: 'General', amount: 350, date: new Date(now.getFullYear(), now.getMonth(), 10) },
    { type: 'expense', title: 'High Electronics Spike', category: 'Electronics', amount: 9000, date: todayDate }
];
const resD = analyzeTransactions(transactionsD, [], todayDate, 0);

const spikeAlert = resD.alerts.find(a => a.tag === 'spending-spike');
assert(!!spikeAlert, 'Identifies sudden large daily spending spike.');
assert(spikeAlert.whatHappened.includes('Electronics') || spikeAlert.title.includes('Electronics'), 'Spike insight cites category name.');
assert(spikeAlert.whatHappened.includes('available balance'), 'Spike insight explains effect on remaining available balance.');


// ----------------------------------------------------
// SCENARIO E — New Goal
// One recent contribution
// ----------------------------------------------------
console.log('\n[SCENARIO E] New Goal...');
const goalsE = [
    { targetName: 'New Bike', targetAmount: 80000, currentAmount: 3000, status: 'active', createdAt: new Date() }
];
const resE = analyzeTransactions(transactionsA, goalsE, now, 10000);

const newGoalAlert = resE.alerts.find(a => a.tag === 'new-goal-encouragement');
assert(!!newGoalAlert, 'Recognizes newly created goal.');
assert(!resE.alerts.some(a => a.whatHappened.toLowerCase().includes('too small')), 'Does NOT criticize goal contribution.');


// ----------------------------------------------------
// SCENARIO F — Consistent Monthly Goal
// Regular contribution over multiple months
// ----------------------------------------------------
console.log('\n[SCENARIO F] Consistent Monthly Goal...');
const goalsF = [
    { targetName: 'House Deposit', targetAmount: 300000, currentAmount: 25000, status: 'active', createdAt: new Date(now.getFullYear(), now.getMonth() - 4, 1) }
];
const resF = analyzeTransactions(transactionsA, goalsF, now, 10000);

const consistentAlert = resF.alerts.find(a => a.tag === 'consistent-goal-progress');
assert(!!consistentAlert, 'Recognizes consistent monthly goal progress.');


// ----------------------------------------------------
// SCENARIO G — Limited Data
// Very few transactions (< 3)
// ----------------------------------------------------
console.log('\n[SCENARIO G] Limited Data...');
const transactionsG = [
    { type: 'income', amount: 30000, isCredited: true, date: new Date() }
];
const resG = analyzeTransactions(transactionsG, [], now, 0);

assert(resG.dataConfidence === 'very_little_data', 'Data confidence set to "very_little_data" for < 3 transactions.');
const limitedNotice = resG.alerts.find(a => a.tag === 'limited-data-notice');
assert(!!limitedNotice, 'Surfaces limited data notice.');
assert(limitedNotice.whatHappened.includes('limited transaction activity'), 'Explains that analysis is based on limited data without fabricating trends.');


// ----------------------------------------------------
// SCENARIO H — Manageable Remaining Month
// Available balance sufficient according to recent spending pace
// ----------------------------------------------------
console.log('\n[SCENARIO H] Manageable Remaining Month...');
const transactionsH = [
    { type: 'income', amount: 40000, isCredited: true, date: new Date(now.getFullYear(), now.getMonth(), 1) },
    { type: 'expense', title: 'General Living', category: 'General', amount: 8000, date: new Date(now.getFullYear(), now.getMonth(), 8) }
];
// Balance = ₹32,000. Elapsed = 18 days. Daily Avg = 8000/18 = ₹444/day. Remaining = 12 days * 444 = ₹5,333. Balance ₹32,000 > ₹5,333!
const resH = analyzeTransactions(transactionsH, [], now, 0);

assert(resH.health.isManageableMonth === true, 'isManageableMonth is true when balance exceeds estimated remaining spend.');
const manageableAlert = resH.alerts.find(a => a.tag === 'manageable-month-pace');
assert(!!manageableAlert, 'Recognizes that user is able to manage the remaining month.');


console.log('\n================================================================');
console.log(`=== TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED ===`);
console.log('================================================================\n');

if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 3 ADVANCED FINANCIAL INTELLIGENCE TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
} else {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
}
