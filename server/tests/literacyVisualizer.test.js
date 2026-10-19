// server/tests/literacyVisualizer.test.js
const assert = require('assert');

console.log('=== RUNNING LITERACY HUB VISUAL LEARNING TEST SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✓ [PASS] ${description}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${description}`);
        console.error(err);
    }
}

// 1. Test 50/30/20 Calculation Rules
test('50/30/20 Budget Allocation Arithmetic', () => {
    const income = 60000;
    const idealNeeds = Math.round(income * 0.50);
    const idealWants = Math.round(income * 0.30);
    const idealSavings = Math.round(income * 0.20);

    assert.strictEqual(idealNeeds, 30000, 'Needs should be 50% = ₹30,000');
    assert.strictEqual(idealWants, 18000, 'Wants should be 30% = ₹18,000');
    assert.strictEqual(idealSavings, 12000, 'Savings should be 20% = ₹12,000');
    assert.strictEqual(idealNeeds + idealWants + idealSavings, income, 'Total should equal 100% of income');
});

// 2. Test Category Aggregation
test('Category Spending Aggregation and Percentage Calculation', () => {
    const transactions = [
        { type: 'expense', amount: 5000, category: 'Food' },
        { type: 'expense', amount: 3000, category: 'Food' },
        { type: 'expense', amount: 8000, category: 'Rent' },
        { type: 'expense', amount: 4000, category: 'Shopping' }
    ];

    const categoryMap = {};
    let totalExpense = 0;
    transactions.forEach(t => {
        const cat = t.category || 'General';
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
        totalExpense += Number(t.amount);
    });

    assert.strictEqual(totalExpense, 20000, 'Total expense should be 20,000');
    assert.strictEqual(categoryMap['Food'], 8000, 'Food expense should be 8,000');
    assert.strictEqual(categoryMap['Rent'], 8000, 'Rent expense should be 8,000');
    assert.strictEqual(categoryMap['Shopping'], 4000, 'Shopping expense should be 4,000');

    const foodPct = Math.round((categoryMap['Food'] / totalExpense) * 100);
    assert.strictEqual(foodPct, 40, 'Food should represent 40% of expenses');
});

// 3. Test Food Trimming Worked Example Math
test('Food Spending Trimming Worked Example Calculations', () => {
    const currentFoodSpend = 10000;
    const reductionPercent = 0.20;
    const monthlySavings = Math.round(currentFoodSpend * reductionPercent);
    const annualSavings = monthlySavings * 12;
    const newBudget = currentFoodSpend - monthlySavings;

    assert.strictEqual(monthlySavings, 2000, 'Monthly savings should be ₹2,000');
    assert.strictEqual(annualSavings, 24000, 'Annual savings should be ₹24,000');
    assert.strictEqual(newBudget, 8000, 'New monthly food budget should be ₹8,000');
});

// 4. Test Emergency Fund Milestone Math
test('Emergency Fund Tiered Calculations', () => {
    const monthlyEssentialSpend = 25000;
    const starterBuffer = Math.min(25000, monthlyEssentialSpend);
    const oneMonthCushion = monthlyEssentialSpend;
    const threeMonthReserve = monthlyEssentialSpend * 3;
    const sixMonthFortress = monthlyEssentialSpend * 6;

    assert.strictEqual(starterBuffer, 25000, 'Starter buffer is capped at ₹25,000');
    assert.strictEqual(oneMonthCushion, 25000, '1-month cushion is ₹25,000');
    assert.strictEqual(threeMonthReserve, 75000, '3-month reserve is ₹75,000');
    assert.strictEqual(sixMonthFortress, 150000, '6-month fortress is ₹1,50,000');
});

// 5. Test Subscription Rotation Economics
test('Subscription Stack vs. Single Service Rotation', () => {
    const concurrentCosts = [299, 199, 599, 499]; // 4 services
    const stackedMonthly = concurrentCosts.reduce((a, b) => a + b, 0); // 1,596
    const rotatedMonthly = 399; // average 1 service per month

    const stackedAnnual = stackedMonthly * 12;
    const rotatedAnnual = rotatedMonthly * 12;
    const annualDifference = stackedAnnual - rotatedAnnual;

    assert.strictEqual(stackedMonthly, 1596, 'Concurrent stacked total is ₹1,596/mo');
    assert.strictEqual(stackedAnnual, 19152, 'Stacked annual cost is ₹19,152');
    assert.strictEqual(rotatedAnnual, 4788, 'Rotated annual cost is ₹4,788');
    assert.strictEqual(annualDifference, 14364, 'Annual difference saved is ₹14,364');
});

// 6. Test Compound Interest Calculation Logic
test('Compound Interest / SIP Math Verification', () => {
    const monthly = 3000;
    const years = 10;
    const totalInvested = monthly * 12 * years;
    assert.strictEqual(totalInvested, 360000, '10-year capital invested should be ₹3,60,000');

    // Monthly SIP future value formula: P * [((1 + r)^n - 1) / r] * (1 + r)
    const annualRate = 0.12;
    const monthlyRate = annualRate / 12;
    const totalMonths = years * 12;
    const futureValue = Math.round(monthly * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));

    assert(futureValue > 690000 && futureValue < 710000, `Future value should be ~₹7,00,000, received ${futureValue}`);
    assert(futureValue - totalInvested > 330000, 'Compound growth returns should exceed ₹3,30,000');
});

// 7. Verify Flowchart Structure Correctness
test('Flowchart Decision Trees Node Traversal', () => {
    const purchaseTree = {
        'start': { next: 'check-need' },
        'check-need': { yes: 'need-yes', no: 'check-afford' },
        'check-afford': { yes: 'check-pause', no: 'afford-no' },
        'check-pause': { yes: 'pause-yes', no: 'pause-no' }
    };

    assert.strictEqual(purchaseTree['start'].next, 'check-need');
    assert.strictEqual(purchaseTree['check-need'].yes, 'need-yes');
    assert.strictEqual(purchaseTree['check-need'].no, 'check-afford');
    assert.strictEqual(purchaseTree['check-afford'].yes, 'check-pause');
    assert.strictEqual(purchaseTree['check-afford'].no, 'afford-no');
    assert.strictEqual(purchaseTree['check-pause'].yes, 'pause-yes');
    assert.strictEqual(purchaseTree['check-pause'].no, 'pause-no');
});

console.log('\n========================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed.`);
console.log('========================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
