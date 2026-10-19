const assert = require('assert');
const {
    parseNaturalLanguageScenario,
    calculateScenario,
    parseAndSimulateScenario,
    toPaise,
    fromPaise
} = require('../utils/whatIfEngine');

console.log('=== RUNNING WHAT-IF SIMULATOR ENGINE ACCEPTANCE TEST SUITE ===\n');

// Standard Test Fixtures
const testTransactions = [
    { type: 'income', amount: 50000, category: 'Salary', description: 'Monthly Salary' },
    { type: 'expense', amount: 8000, category: 'Food', description: 'Groceries and dining' },
    { type: 'expense', amount: 4000, category: 'Transport', description: 'Fuel and commute' },
    { type: 'expense', amount: 3000, category: 'Entertainment', description: 'Movies and OTT' },
    { type: 'expense', amount: 15000, category: 'Bills', description: 'House rent' }
];

const testGoals = [
    { name: 'Emergency Fund', targetAmount: 100000, currentAmount: 40000 }
];

const testProfile = {
    openingBalance: 25000
};

let passedCount = 0;
let totalCount = 0;

function runTest(testName, testFn) {
    totalCount++;
    try {
        testFn();
        console.log(`✓ [PASS] ${testName}`);
        passedCount++;
    } catch (err) {
        console.error(`✗ [FAIL] ${testName}`);
        console.error(`  Error: ${err.message}`);
        console.error(err.stack);
    }
}

// -------------------------------------------------------------
// BUG 1 ACCEPTANCE: "What if I save ₹2,000 more every month?"
// Must NOT be classified as spending, must NOT report currentSpending ₹0 or expense increase!
// -------------------------------------------------------------
runTest('BUG 1: "What if I save ₹2,000 more every month?" -> ADDITIONAL_SAVINGS scenario', () => {
    const result = parseAndSimulateScenario('What if I save ₹2,000 more every month?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.scenarioType, 'ADDITIONAL_SAVINGS');
    assert.strictEqual(result.plannedMonthlySavings, 2000);
    assert.strictEqual(result.projectedAnnualSavings, 24000);
    assert.strictEqual(result.monthlySurplus, 20000); // 50,000 income - 30,000 expenses
    assert.strictEqual(result.affordabilityStatus, 'AFFORDABLE');
    assert.strictEqual(result.currentSpending, undefined, 'Must NOT report currentSpending');
    assert.strictEqual(result.newSpending, undefined, 'Must NOT report newSpending');
    assert.strictEqual(result.hasGoalData, true);
    // Remaining goal = 100,000 - 40,000 = 60,000. 60,000 / 2,000 = 30 months
    assert.strictEqual(result.monthsToReachGoal, 30);
    assert.ok(result.goalImpactText.includes('Emergency Fund'));
    assert.ok(result.goalImpactText.includes('30 months'));
});

// -------------------------------------------------------------
// BUG 1 VARIATION: "What if I put aside ₹1,500 every month?"
// -------------------------------------------------------------
runTest('BUG 1 Variation: "What if I put aside ₹1,500 every month?" -> ADDITIONAL_SAVINGS', () => {
    const result = parseAndSimulateScenario('What if I put aside ₹1,500 every month?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.scenarioType, 'ADDITIONAL_SAVINGS');
    assert.strictEqual(result.plannedMonthlySavings, 1500);
    assert.strictEqual(result.projectedAnnualSavings, 18000);
    assert.strictEqual(result.affordabilityStatus, 'AFFORDABLE');
});

// -------------------------------------------------------------
// BUG 1 AFFORDABILITY DEFICIT: Planned savings exceeds surplus
// Income 20,000, Expenses 19,000 -> Surplus 1,000. Planned savings 5,000.
// -------------------------------------------------------------
runTest('BUG 1 Feasibility: Tight surplus flags TIGHT_OR_DEFICIT with shortfall advice', () => {
    const tightTx = [
        { type: 'income', amount: 20000, category: 'Salary' },
        { type: 'expense', amount: 19000, category: 'Living' }
    ];
    const result = parseAndSimulateScenario('What if I save ₹5,000 more every month?', tightTx, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.affordabilityStatus, 'TIGHT_OR_DEFICIT');
    assert.ok(result.affordabilityMessage.includes('discretionary expenses'));
});

// -------------------------------------------------------------
// BUG 1 NO GOALS FALLBACK: User has no active goals
// -------------------------------------------------------------
runTest('BUG 1 No Goals: "Goal impact unavailable — add a savings goal to calculate this."', () => {
    const result = parseAndSimulateScenario('What if I save ₹2,000 more every month?', testTransactions, [], testProfile);
    assert.strictEqual(result.hasGoalData, false);
    assert.strictEqual(result.goalImpactText, 'Goal impact unavailable — add a savings goal to calculate this.');
});

// -------------------------------------------------------------
// SCENARIO 1: Cut down on food expenses (Ambiguous Amount -> Clarification)
// -------------------------------------------------------------
runTest('Scenario 1: "What happens if I cut down on food expenses?" asks for clarification without guessing', () => {
    const parsed = parseNaturalLanguageScenario('What happens if I cut down on food expenses?');
    assert.strictEqual(parsed.needsClarification, true, 'Should flag needsClarification');
    assert.strictEqual(parsed.components[0].category, 'Food', 'Identifies Food category');
    assert.ok(parsed.clarificationQuestion.includes('Food'), 'Clarification asks about Food');
    assert.ok(Array.isArray(parsed.clarificationOptions), 'Offers suggestions');
});

// -------------------------------------------------------------
// SCENARIO 2: Spend 15% more on transport
// -------------------------------------------------------------
runTest('Scenario 2: "Suppose I spend 15% more on transport." -> INCREASE 15%', () => {
    const result = parseAndSimulateScenario('Suppose I spend 15% more on transport.', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.direction, 'INCREASE');
    assert.strictEqual(result.categoryName, 'Transport');
    assert.strictEqual(result.currentSpending, 4000);
    assert.strictEqual(result.changeAmount, 600); // 15% of 4000 = 600
    assert.strictEqual(result.newSpending, 4600);
    assert.strictEqual(result.monthlyImpact, -600);
    assert.strictEqual(result.annualImpact, -7200);
});

// -------------------------------------------------------------
// SCENARIO 3: Stop ordering food completely
// -------------------------------------------------------------
runTest('Scenario 3: "How much could I save if I stopped ordering food?" -> 100% reduction in Food', () => {
    const result = parseAndSimulateScenario('How much could I save if I stopped ordering food?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.direction, 'REDUCE');
    assert.strictEqual(result.categoryName, 'Food');
    assert.strictEqual(result.currentSpending, 8000);
    assert.strictEqual(result.changeAmount, 8000);
    assert.strictEqual(result.newSpending, 0);
    assert.strictEqual(result.monthlyImpact, 8000);
    assert.strictEqual(result.annualImpact, 96000);
});

// -------------------------------------------------------------
// SCENARIO 4: Rent increases by ₹2,000
// -------------------------------------------------------------
runTest('Scenario 4: "What if my rent increases by ₹2,000?" -> INCREASE ₹2,000 in Bills', () => {
    const result = parseAndSimulateScenario('What if my rent increases by ₹2,000?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.direction, 'INCREASE');
    assert.strictEqual(result.categoryName, 'Bills');
    assert.strictEqual(result.currentSpending, 15000);
    assert.strictEqual(result.changeAmount, 2000);
    assert.strictEqual(result.newSpending, 17000);
    assert.strictEqual(result.monthlyImpact, -2000);
});

// -------------------------------------------------------------
// SCENARIO 5: One-Time Affordability Check (₹87,000 Laptop)
// Current balance: Opening (25,000) + Income (50,000) - Expenses (30,000) = 45,000
// -------------------------------------------------------------
runTest('Scenario 5: "Can I buy a laptop worth ₹87,000?" evaluates against current balance (₹45,000)', () => {
    const result = parseAndSimulateScenario('Can I buy a laptop worth ₹87,000?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.scenarioType, 'ONE_TIME_PURCHASE');
    assert.strictEqual(result.purchaseCost, 87000);
    assert.strictEqual(result.currentBalance, 45000);
    assert.strictEqual(result.projectedBalance, -42000);
    assert.strictEqual(result.isAffordable, false);
    assert.strictEqual(result.shortfall, 42000);
    assert.ok(result.monthsToSave >= 2, 'Calculates months to save');
    assert.ok(!result.annualImpact, 'Does NOT report false annual savings');
});

// -------------------------------------------------------------
// SCENARIO 6: Loss of income for two months
// Monthly expenses: 30,000. Total 2 mo deficit: 60,000.
// -------------------------------------------------------------
runTest('Scenario 6: "What if I lose my income for two months?" calculates 2-month deficit', () => {
    const result = parseAndSimulateScenario('What if I lose my income for two months?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.scenarioType, 'INCOME_LOSS');
    assert.strictEqual(result.durationMonths, 2);
    assert.strictEqual(result.monthlyExpenses, 30000);
    assert.strictEqual(result.totalDeficit, 60000);
    assert.strictEqual(result.currentBalance, 45000);
    assert.strictEqual(result.projectedBalance, -15000);
});

// -------------------------------------------------------------
// SCENARIO 7: Weekly frequency conversion (₹500 weekly coffee)
// 500 * 52 / 12 = 2166.67
// -------------------------------------------------------------
runTest('Scenario 7: "What if I spend ₹500 more on coffee every week?" converts weekly to monthly', () => {
    const result = parseAndSimulateScenario('What if I spend ₹500 more on coffee every week?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.direction, 'INCREASE');
    assert.strictEqual(result.frequency, 'weekly');
    assert.strictEqual(result.changeAmount, 2166.67);
    assert.strictEqual(result.newSpending, 10166.67);
});

// -------------------------------------------------------------
// SCENARIO 8: Save all money left after expenses
// Income: 50,000, Expenses: 30,000 -> Surplus = 20,000
// -------------------------------------------------------------
runTest('Scenario 8: "What if I save all the money left after expenses?" saves monthly surplus', () => {
    const result = parseAndSimulateScenario('What if I save all the money left after expenses?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.scenarioType, 'ADDITIONAL_SAVINGS');
    assert.strictEqual(result.plannedMonthlySavings, 20000);
    assert.strictEqual(result.projectedAnnualSavings, 240000);
});

// -------------------------------------------------------------
// SCENARIO 9: Status quo current spending pace
// Monthly expenses: 30,000
// -------------------------------------------------------------
runTest('Scenario 9: "What if I continue spending at my current rate?" projects 3, 6, 12 months', () => {
    const result = parseAndSimulateScenario('What if I continue spending at my current rate?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.scenarioType, 'STATUS_QUO');
    assert.strictEqual(result.monthlySpending, 30000);
    assert.strictEqual(result.projected3Months, 90000);
    assert.strictEqual(result.projected6Months, 180000);
    assert.strictEqual(result.projected12Months, 360000);
});

// -------------------------------------------------------------
// SCENARIO 10: Incomplete question "What if I by 20%?"
// Must trigger clarification and NOT guess
// -------------------------------------------------------------
runTest('Scenario 10: "What if I by 20%?" strictly triggers clarification without guessing', () => {
    const parsed = parseNaturalLanguageScenario('What if I by 20%?');
    assert.strictEqual(parsed.needsClarification, true);
    assert.strictEqual(parsed.isComplete, false);
    assert.ok(parsed.clarificationQuestion.includes('20%'));
    assert.ok(Array.isArray(parsed.clarificationOptions));
});

// -------------------------------------------------------------
// SCENARIO 11: Multi-turn conversational context resolution
// Turn 1: "What if I reduce food spending by 20%?"
// Turn 2: "What if I increase it by 20%?" -> Resolves 'it' to Food, direction = INCREASE
// -------------------------------------------------------------
runTest('Scenario 11: Multi-turn conversation resolves pronoun "it" and changes direction to INCREASE', () => {
    const res1 = parseAndSimulateScenario('What if I reduce food spending by 20%?', testTransactions, testGoals, testProfile);
    assert.strictEqual(res1.direction, 'REDUCE');
    assert.strictEqual(res1.categoryName, 'Food');

    const res2 = parseAndSimulateScenario('What if I increase it by 20%?', testTransactions, testGoals, testProfile, res1.conversationContext);
    assert.strictEqual(res2.hasData, true);
    assert.strictEqual(res2.direction, 'INCREASE');
    assert.strictEqual(res2.categoryName, 'Food');
    assert.strictEqual(res2.changeAmount, 1600); // 20% of 8000
    assert.strictEqual(res2.newSpending, 9600);
    assert.strictEqual(res2.monthlyImpact, -1600);
});

// -------------------------------------------------------------
// SCENARIO 12: Combined multi-change scenario
// "What if I reduce food by 10% and increase transport by ₹500?"
// -------------------------------------------------------------
runTest('Scenario 12: Combined scenario: reduce food 10% and increase transport ₹500', () => {
    const result = parseAndSimulateScenario('What if I reduce food by 10% and increase transport by ₹500?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.scenarioType, 'COMBINED');
    assert.strictEqual(result.componentsDetail.length, 2);
    assert.strictEqual(result.componentsDetail[0].category, 'Food');
    assert.strictEqual(result.componentsDetail[0].monthlyImpact, 800);
    assert.strictEqual(result.componentsDetail[1].category, 'Transport');
    assert.strictEqual(result.componentsDetail[1].monthlyImpact, -500);
    assert.strictEqual(result.netMonthlyImpact, 300);
    assert.strictEqual(result.netAnnualImpact, 3600);
    assert.strictEqual(result.isNetSavings, true);
});

// -------------------------------------------------------------
// SCENARIO 13: Vague savings question without amount
// "What if I save more?" -> triggers clarification
// -------------------------------------------------------------
runTest('Scenario 13: "What if I save more?" triggers clarification for amount', () => {
    const parsed = parseNaturalLanguageScenario('What if I save more?');
    assert.strictEqual(parsed.needsClarification, true);
    assert.ok(parsed.clarificationQuestion.includes('How much more would you like to save'));
    assert.ok(Array.isArray(parsed.clarificationOptions));
});

// -------------------------------------------------------------
// SCENARIO 14: Goal acceleration question without amount
// "Can I reach my laptop goal sooner if I save more?" -> triggers clarification
// -------------------------------------------------------------
runTest('Scenario 14: "Can I reach my laptop goal sooner if I save more?" triggers clarification', () => {
    const parsed = parseNaturalLanguageScenario('Can I reach my laptop goal sooner if I save more?');
    assert.strictEqual(parsed.needsClarification, true);
    assert.ok(parsed.clarificationQuestion.includes('toward your goal'));
});

// -------------------------------------------------------------
// SCENARIO 15: Income drop scenario
// "What if my salary drops by ₹5,000?" -> INCOME_CHANGE
// -------------------------------------------------------------
runTest('Scenario 15: "What if my salary drops by ₹5,000?" -> INCOME_CHANGE', () => {
    const result = parseAndSimulateScenario('What if my salary drops by ₹5,000?', testTransactions, testGoals, testProfile);
    assert.strictEqual(result.hasData, true);
    assert.strictEqual(result.scenarioType, 'INCOME_CHANGE');
    assert.strictEqual(result.direction, 'REDUCE');
    assert.strictEqual(result.originalIncome, 50000);
    assert.strictEqual(result.projectedIncome, 45000);
    assert.strictEqual(result.monthlyIncomeDelta, -5000);
    assert.strictEqual(result.annualIncomeDelta, -60000);
    assert.strictEqual(result.originalSurplus, 20000);
    assert.strictEqual(result.projectedSurplus, 15000);
    assert.strictEqual(result.isSurplusPositive, true);
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passedCount}/${totalCount} tests passed.`);
console.log(`========================================\n`);

if (passedCount !== totalCount) {
    process.exit(1);
}
