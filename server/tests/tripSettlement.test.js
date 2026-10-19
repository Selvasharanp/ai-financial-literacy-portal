const assert = require('assert');
const { calculateTrip, validateSettlement, toPaise, fromPaise } = require('../utils/tripCalculator');

console.log('🧪 RUNNING FULL TRIP SPLITTER AUDIT & MATHEMATICAL INVARIANTS TEST SUITE...\n');

// ============================================================================
// TEST 1: Section 5 Required Acceptance Test
// ============================================================================
(() => {
    console.log('▶ TEST 1: Section 5 Required Acceptance Test (Sharan ₹500, Suresh ₹700 shared equally by 4)');
    const participants = [
        { id: 'p_sharan', name: 'Sharan' },
        { id: 'p_suresh', name: 'Suresh' },
        { id: 'p_thilak', name: 'Thilak' },
        { id: 'p_kabilan', name: 'Kabilan' }
    ];

    const expenses = [
        { description: 'Expense A: Sharan paid', amount: 500, paidBy: 'p_sharan', sharedWith: ['p_sharan', 'p_suresh', 'p_thilak', 'p_kabilan'] },
        { description: 'Expense B: Suresh paid', amount: 700, paidBy: 'p_suresh', sharedWith: ['p_sharan', 'p_suresh', 'p_thilak', 'p_kabilan'] }
    ];

    const result = calculateTrip(participants, expenses, []);

    // 1. Total Trip Expense
    assert.strictEqual(result.totalTripExpense, 1200, 'Total trip expense must be 1200');

    // 2. Net Balances
    const sharan = result.participantSummary.find(p => p.id === 'p_sharan');
    const suresh = result.participantSummary.find(p => p.id === 'p_suresh');
    const thilak = result.participantSummary.find(p => p.id === 'p_thilak');
    const kabilan = result.participantSummary.find(p => p.id === 'p_kabilan');

    assert.strictEqual(sharan.totalPaid, 500);
    assert.strictEqual(sharan.fairShare, 300);
    assert.strictEqual(sharan.netBalance, 200, 'Sharan must receive ₹200');

    assert.strictEqual(suresh.totalPaid, 700);
    assert.strictEqual(suresh.fairShare, 300);
    assert.strictEqual(suresh.netBalance, 400, 'Suresh must receive ₹400');

    assert.strictEqual(thilak.totalPaid, 0);
    assert.strictEqual(thilak.fairShare, 300);
    assert.strictEqual(thilak.netBalance, -300, 'Thilak must owe ₹300');

    assert.strictEqual(kabilan.totalPaid, 0);
    assert.strictEqual(kabilan.fairShare, 300);
    assert.strictEqual(kabilan.netBalance, -300, 'Kabilan must owe ₹300');

    // 3. Exact Running Matrix Check (Matching prompt Section 5 character-for-character)
    // Matrix indices: 0: Sharan, 1: Suresh, 2: Thilak, 3: Kabilan
    const matrix = result.runningMatrix.matrix;

    // Row Sharan: [—, 50, 0, 0]
    assert.strictEqual(matrix[0][1], 50, 'Sharan owes Suresh ₹50');
    assert.strictEqual(matrix[0][2], 0, 'Sharan owes Thilak ₹0');
    assert.strictEqual(matrix[0][3], 0, 'Sharan owes Kabilan ₹0');

    // Row Suresh: [0, —, 0, 0]
    assert.strictEqual(matrix[1][0], 0, 'Suresh owes Sharan ₹0');
    assert.strictEqual(matrix[1][2], 0, 'Suresh owes Thilak ₹0');
    assert.strictEqual(matrix[1][3], 0, 'Suresh owes Kabilan ₹0');

    // Row Thilak: [125, 175, —, 0]
    assert.strictEqual(matrix[2][0], 125, 'Thilak owes Sharan ₹125');
    assert.strictEqual(matrix[2][1], 175, 'Thilak owes Suresh ₹175');
    assert.strictEqual(matrix[2][3], 0, 'Thilak owes Kabilan ₹0');

    // Row Kabilan: [125, 175, 0, —]
    assert.strictEqual(matrix[3][0], 125, 'Kabilan owes Sharan ₹125');
    assert.strictEqual(matrix[3][1], 175, 'Kabilan owes Suresh ₹175');
    assert.strictEqual(matrix[3][2], 0, 'Kabilan owes Thilak ₹0');

    // 4. Row Totals & Col Totals Check
    const rowTotals = result.runningMatrix.rowTotals;
    const colTotals = result.runningMatrix.colTotals;
    assert.strictEqual(rowTotals[0], 50, 'Sharan row total = 50');
    assert.strictEqual(rowTotals[1], 0, 'Suresh row total = 0');
    assert.strictEqual(rowTotals[2], 300, 'Thilak row total = 300');
    assert.strictEqual(rowTotals[3], 300, 'Kabilan row total = 300');

    assert.strictEqual(colTotals[0], 250, 'Sharan col total = 250');
    assert.strictEqual(colTotals[1], 400, 'Suresh col total = 400');
    assert.strictEqual(colTotals[2], 0, 'Thilak col total = 0');
    assert.strictEqual(colTotals[3], 0, 'Kabilan col total = 0');

    // Col total - Row total equals Net Balance
    assert.strictEqual(colTotals[0] - rowTotals[0], 200);
    assert.strictEqual(colTotals[1] - rowTotals[1], 400);
    assert.strictEqual(colTotals[2] - rowTotals[2], -300);
    assert.strictEqual(colTotals[3] - rowTotals[3], -300);

    // 5. Zero-sum invariant
    const netSum = result.participantSummary.reduce((sum, p) => sum + toPaise(p.netBalance), 0);
    assert.strictEqual(netSum, 0, 'Sum of all net balances must be strictly 0');

    console.log('  ✅ TEST 1 PASSED: Exact Acceptance Test Matrix & Balances Verified!\n');
})();

// ============================================================================
// TEST 2: Section 6 Separation of Running Matrix vs Optimized Settlements
// ============================================================================
(() => {
    console.log('▶ TEST 2: Section 6 Separation of Running Matrix vs Optimized Settlements');
    const participants = [
        { id: 'p_sharan', name: 'Sharan' },
        { id: 'p_suresh', name: 'Suresh' },
        { id: 'p_thilak', name: 'Thilak' },
        { id: 'p_kabilan', name: 'Kabilan' }
    ];

    const expenses = [
        { description: 'Expense A', amount: 500, paidBy: 'p_sharan', sharedWith: ['p_sharan', 'p_suresh', 'p_thilak', 'p_kabilan'] },
        { description: 'Expense B', amount: 700, paidBy: 'p_suresh', sharedWith: ['p_sharan', 'p_suresh', 'p_thilak', 'p_kabilan'] }
    ];

    const result = calculateTrip(participants, expenses, []);

    // Direct pairwise debts has 5 individual transfers
    assert.strictEqual(result.pairwiseDebts.length, 5, 'Pairwise debts has 5 direct transfers');

    // Optimized settlements simplifies to 3 transfers
    assert.strictEqual(result.optimizedSettlements.length, 3, 'Optimized settlements simplifies to 3 transfers');

    // Check optimized settlements preserve the exact net balances
    const optBalances = {};
    participants.forEach(p => optBalances[p.id] = 0);
    result.optimizedSettlements.forEach(s => {
        optBalances[s.fromId] -= toPaise(s.amount);
        optBalances[s.toId] += toPaise(s.amount);
    });

    assert.strictEqual(fromPaise(optBalances['p_sharan']), 200, 'Optimized settlement preserves Sharan +200');
    assert.strictEqual(fromPaise(optBalances['p_suresh']), 400, 'Optimized settlement preserves Suresh +400');
    assert.strictEqual(fromPaise(optBalances['p_thilak']), -300, 'Optimized settlement preserves Thilak -300');
    assert.strictEqual(fromPaise(optBalances['p_kabilan']), -300, 'Optimized settlement preserves Kabilan -300');

    // Running matrix cell [0][1] remains Sharan owes Suresh ₹50 and is NOT overwritten
    assert.strictEqual(result.runningMatrix.matrix[0][1], 50, 'Running matrix retains pairwise obligation');

    console.log('  ✅ TEST 2 PASSED: Running Ledger and Optimized Settlement are cleanly separated!\n');
})();

// ============================================================================
// TEST 3: Section 7 Payment Tracking, Partial Settlements & Overpayment Validation
// ============================================================================
(() => {
    console.log('▶ TEST 3: Section 7 Payment Tracking, Partial Settlements & Overpayment Validation');
    const participants = [
        { id: 'p_sharan', name: 'Sharan' },
        { id: 'p_suresh', name: 'Suresh' },
        { id: 'p_thilak', name: 'Thilak' },
        { id: 'p_kabilan', name: 'Kabilan' }
    ];

    const expenses = [
        { description: 'Expense A', amount: 500, paidBy: 'p_sharan', sharedWith: ['p_sharan', 'p_suresh', 'p_thilak', 'p_kabilan'] },
        { description: 'Expense B', amount: 700, paidBy: 'p_suresh', sharedWith: ['p_sharan', 'p_suresh', 'p_thilak', 'p_kabilan'] }
    ];

    // Initial state
    let res = calculateTrip(participants, expenses, []);

    // 1. Sharan pays Suresh ₹50
    let val1 = validateSettlement(res, 'p_sharan', 'p_suresh', 50);
    assert.strictEqual(val1.valid, true, 'Sharan paying Suresh 50 is valid');

    // Try overpayment: Sharan pays Suresh ₹60
    let valOver = validateSettlement(res, 'p_sharan', 'p_suresh', 60);
    assert.strictEqual(valOver.valid, false, 'Overpayment must be rejected');

    // Try invalid pair: Suresh paying Sharan when Suresh owes nothing
    let valInvalid = validateSettlement(res, 'p_suresh', 'p_sharan', 50);
    assert.strictEqual(valInvalid.valid, false, 'Payment with no debt must be rejected');

    // Record Sharan -> Suresh ₹50
    let settlements = [
        { fromParticipantId: 'p_sharan', toParticipantId: 'p_suresh', amount: 50 }
    ];
    res = calculateTrip(participants, expenses, settlements);

    // Sharan owes Suresh ₹0 now!
    assert.strictEqual(res.runningMatrix.matrix[0][1], 0, 'Sharan owes Suresh 0 now');
    assert.strictEqual(res.runningMatrix.rowTotals[0], 0, 'Sharan total debt is now 0');

    // 2. Partial payment: Thilak pays Suresh ₹100 (out of ₹175 owed)
    let valPartial = validateSettlement(res, 'p_thilak', 'p_suresh', 100);
    assert.strictEqual(valPartial.valid, true);

    settlements.push({ fromParticipantId: 'p_thilak', toParticipantId: 'p_suresh', amount: 100 });
    res = calculateTrip(participants, expenses, settlements);

    // Thilak now owes Suresh ₹75 (175 - 100)
    assert.strictEqual(res.runningMatrix.matrix[2][1], 75, 'Thilak owes Suresh remaining 75');
    assert.strictEqual(res.participantSummary.find(p => p.id === 'p_thilak').netBalance, -200, 'Thilak net balance is -200 now');

    // Complete all remaining debts
    settlements.push(
        { fromParticipantId: 'p_thilak', toParticipantId: 'p_suresh', amount: 75 },
        { fromParticipantId: 'p_thilak', toParticipantId: 'p_sharan', amount: 125 },
        { fromParticipantId: 'p_kabilan', toParticipantId: 'p_sharan', amount: 125 },
        { fromParticipantId: 'p_kabilan', toParticipantId: 'p_suresh', amount: 175 }
    );
    res = calculateTrip(participants, expenses, settlements);

    // All debts 0, isAllSettled true
    assert.strictEqual(res.isAllSettled, true, 'Trip is fully settled');
    res.participantSummary.forEach(p => {
        assert.strictEqual(p.netBalance, 0, `${p.name} net balance is 0`);
    });

    console.log('  ✅ TEST 3 PASSED: Settlements, partial payments, and validation working correctly!\n');
})();

// ============================================================================
// TEST 4: Dynamic Subsets & Uneven Remainder Division
// ============================================================================
(() => {
    console.log('▶ TEST 4: Dynamic Subsets, Uneven Splits & Paise Invariants');
    const participants = [
        { id: 'p_1', name: 'User 1' },
        { id: 'p_2', name: 'User 2' },
        { id: 'p_3', name: 'User 3' }
    ];

    // Expense of ₹100 split 3 ways -> 33.34, 33.33, 33.33
    const expenses = [
        { description: 'Odd Expense', amount: 100, paidBy: 'p_1', sharedWith: ['p_1', 'p_2', 'p_3'] }
    ];

    const res = calculateTrip(participants, expenses, []);
    const p1 = res.participantSummary.find(p => p.id === 'p_1');
    const p2 = res.participantSummary.find(p => p.id === 'p_2');
    const p3 = res.participantSummary.find(p => p.id === 'p_3');

    // Allocated shares sum exactly to 100
    const totalSharesPaise = toPaise(p1.fairShare) + toPaise(p2.fairShare) + toPaise(p3.fairShare);
    assert.strictEqual(totalSharesPaise, 10000, 'Sum of shares equals original expense exactly');

    // Net balances sum to 0
    const sumNet = res.participantSummary.reduce((sum, p) => sum + toPaise(p.netBalance), 0);
    assert.strictEqual(sumNet, 0, 'Sum of net balances is 0');

    // Running matrix: User 2 owes User 1 33.33, User 3 owes User 1 33.33
    assert.strictEqual(res.runningMatrix.matrix[1][0], 33.33);
    assert.strictEqual(res.runningMatrix.matrix[2][0], 33.33);
    // User 1 owes User 2 is 0 (no opposing debts)
    assert.strictEqual(res.runningMatrix.matrix[0][1], 0);

    console.log('  ✅ TEST 4 PASSED: Paise remainder handling and non-opposing invariants verified!\n');
})();

// ============================================================================
// TEST 5: Expense Editing and Deletion
// ============================================================================
(() => {
    console.log('▶ TEST 5: Expense Editing and Deletion Recalculations');
    const participants = [
        { id: 'p_a', name: 'A' },
        { id: 'p_b', name: 'B' }
    ];

    let expenses = [
        { id: 'e1', description: 'Lunch', amount: 400, paidBy: 'p_a', sharedWith: ['p_a', 'p_b'] }
    ];

    let res = calculateTrip(participants, expenses, []);
    assert.strictEqual(res.runningMatrix.matrix[1][0], 200, 'B owes A 200');

    // Edit amount to 600
    expenses = [
        { id: 'e1', description: 'Lunch', amount: 600, paidBy: 'p_a', sharedWith: ['p_a', 'p_b'] }
    ];
    res = calculateTrip(participants, expenses, []);
    assert.strictEqual(res.runningMatrix.matrix[1][0], 300, 'B owes A 300');

    // Delete expense
    expenses = [];
    res = calculateTrip(participants, expenses, []);
    assert.strictEqual(res.runningMatrix.matrix[1][0], 0, 'Debts cleared after delete');
    assert.strictEqual(res.isAllSettled, true);

    console.log('  ✅ TEST 5 PASSED: Edit and delete recalculations verified!\n');
})();

// ============================================================================
// TEST 6: Edge Cases (Empty trip, 1 participant expense, 2 participants)
// ============================================================================
(() => {
    console.log('▶ TEST 6: Edge Cases (Empty trip, 1-person expense)');
    const participants = [
        { id: 'p_x', name: 'X' },
        { id: 'p_y', name: 'Y' }
    ];

    // Empty trip
    let res = calculateTrip(participants, [], []);
    assert.strictEqual(res.totalTripExpense, 0);
    assert.strictEqual(res.isAllSettled, true);
    assert.strictEqual(res.runningMatrix.matrix[0][1], 0);

    // Expense paid by X and only shared with X (personal expense during trip)
    const personalExp = [
        { description: 'X solo coffee', amount: 150, paidBy: 'p_x', sharedWith: ['p_x'] }
    ];
    res = calculateTrip(participants, personalExp, []);
    // X paid 150, fair share is 150 -> Net balance is 0! Y owes nothing!
    assert.strictEqual(res.participantSummary.find(p => p.id === 'p_x').netBalance, 0);
    assert.strictEqual(res.participantSummary.find(p => p.id === 'p_y').netBalance, 0);
    assert.strictEqual(res.runningMatrix.matrix[1][0], 0, 'Y owes X 0 for X solo expense');

    console.log('  ✅ TEST 6 PASSED: Edge cases verified!\n');
})();

console.log('🎉 ALL FULL AUDIT TRIP SPLITTER INVARIANTS & ACCEPTANCE TESTS PASSED 100%!\n');
