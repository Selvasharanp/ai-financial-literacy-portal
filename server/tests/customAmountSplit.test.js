const assert = require('assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Trip = require('../models/Trip');
const TripMember = require('../models/TripMember');
const TripExpense = require('../models/TripExpense');
const TripSettlement = require('../models/TripSettlement');
const Transaction = require('../models/Transaction');
const { calculateTrip } = require('../utils/tripCalculator');
const tripController = require('../controllers/tripController');

console.log('🧪 RUNNING COMPREHENSIVE CUSTOM AMOUNT SPLIT TEST SUITE...\n');

// Mock Express req and res helper
function createMockReqRes(user, trip, body = {}, params = {}, query = {}) {
    const req = {
        user: { id: user._id.toString(), email: user.email, name: user.name },
        trip,
        isTripCreator: trip.userId.toString() === user._id.toString(),
        body,
        params,
        query
    };

    let resData = null;
    let resStatus = 200;

    const res = {
        status: (code) => {
            resStatus = code;
            return res;
        },
        json: (data) => {
            resData = data;
            return res;
        }
    };

    return { req, res, getStatus: () => resStatus, getData: () => resData };
}

async function run() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        console.error('MONGO_URI is not defined in server/.env');
        process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB for Custom Amount Split Verification.\n');

    const prefix = `custom_split_${Date.now()}_`;
    const users = {};
    let testTrip = null;

    try {
        // ---------------------------------------------------------------------
        // STEP 1: SETUP TEST ACCOUNTS & COLLABORATIVE TRIP
        // ---------------------------------------------------------------------
        console.log('▶ STEP 1: Setting up accounts (Sharan, Suresh, Thilak, Kabilan, Stranger)...');
        const accountConfigs = [
            { key: 'sharan', name: 'Sharan', email: `${prefix}sharan@test.com`, openingBalance: 15000 },
            { key: 'suresh', name: 'Suresh', email: `${prefix}suresh@test.com`, openingBalance: 20000 },
            { key: 'thilak', name: 'Thilak', email: `${prefix}thilak@test.com`, openingBalance: 10000 },
            { key: 'kabilan', name: 'Kabilan', email: `${prefix}kabilan@test.com`, openingBalance: 12000 },
            { key: 'stranger', name: 'Stranger', email: `${prefix}stranger@test.com`, openingBalance: 5000 }
        ];

        for (const cfg of accountConfigs) {
            const u = new User({
                name: cfg.name,
                email: cfg.email,
                password: 'mockpassword',
                openingBalance: cfg.openingBalance,
                isVerified: true
            });
            await u.save();
            users[cfg.key] = u;
        }

        const participants = [
            { id: 'p_sharan', name: 'Sharan', email: users.sharan.email },
            { id: 'p_suresh', name: 'Suresh', email: users.suresh.email },
            { id: 'p_thilak', name: 'Thilak', email: users.thilak.email },
            { id: 'p_kabilan', name: 'Kabilan', email: users.kabilan.email }
        ];

        testTrip = new Trip({
            userId: users.sharan._id,
            name: 'Goa Restaurant Trip 2026',
            description: 'Custom amount split test trip',
            collaborativeMode: true,
            participants
        });
        await testTrip.save();

        // Register 4 accepted members
        for (const p of participants) {
            const userKey = p.name.toLowerCase();
            const tm = new TripMember({
                tripId: testTrip._id,
                userId: users[userKey]._id,
                participantId: p.id,
                role: userKey === 'sharan' ? 'creator' : 'member'
            });
            await tm.save();
        }

        console.log('  ✅ Trip and 4 accepted members created.\n');

        const getNet = (c, pId) => c.participantSummary.find(x => x.id === pId)?.netBalance ?? 0;

        // ---------------------------------------------------------------------
        // STEP 2: TEST 1 — EXISTING EQUAL SPLIT CONTINUES TO WORK
        // ---------------------------------------------------------------------
        console.log('▶ STEP 2: Testing Existing Equal Split (₹400 shared by 4)...');
        {
            const { req, res, getStatus, getData } = createMockReqRes(
                users.sharan,
                testTrip,
                {
                    description: 'Toll & Parking',
                    amount: 400,
                    paidBy: 'p_sharan',
                    splitType: 'equal',
                    sharedWith: ['p_sharan', 'p_suresh', 'p_thilak', 'p_kabilan']
                }
            );

            await tripController.addTripExpense(req, res);
            assert.strictEqual(getStatus(), 201, 'Equal split expense should return HTTP 201');
            const exp = getData();
            assert.strictEqual(exp.splitType, 'equal');
            assert.strictEqual(exp.amount, 400);

            const getNet = (calc, pId) => calc.participantSummary.find(x => x.id === pId)?.netBalance ?? 0;

            // Verify calculation
            const expenses = await TripExpense.find({ tripId: testTrip._id });
            const calc = calculateTrip(testTrip.participants, expenses, []);
            assert.strictEqual(calc.totalTripExpense, 400);
            assert.strictEqual(getNet(calc, 'p_sharan'), 300);
            assert.strictEqual(getNet(calc, 'p_suresh'), -100);
            assert.strictEqual(getNet(calc, 'p_thilak'), -100);
            assert.strictEqual(getNet(calc, 'p_kabilan'), -100);
            console.log('  ✅ TEST 1 PASSED: Equal Split works as expected.\n');
        }

        // Clean up step 2 expense before custom test
        await TripExpense.deleteMany({ tripId: testTrip._id });

        // ---------------------------------------------------------------------
        // STEP 3: TEST 2 — CUSTOM AMOUNT SPLIT (THE SPECIFIED RESTAURANT EXAMPLE)
        // Sharan enters the expense.
        // Suresh paid ₹700.
        // Sharan owes ₹200, Suresh owes ₹100, Thilak owes ₹150, Kabilan owes ₹250.
        // Sum: 200 + 100 + 150 + 250 = 700.
        // ---------------------------------------------------------------------
        console.log('▶ STEP 3: Testing Custom Amount Split Example (₹700 paid by Suresh, recorded by Sharan)...');
        let customExpenseId = null;
        {
            const customShares = [
                { participantId: 'p_sharan', amount: 200 },
                { participantId: 'p_suresh', amount: 100 },
                { participantId: 'p_thilak', amount: 150 },
                { participantId: 'p_kabilan', amount: 250 }
            ];

            const { req, res, getStatus, getData } = createMockReqRes(
                users.sharan, // Recorder is Sharan
                testTrip,
                {
                    description: 'Restaurant Seafood Feast',
                    amount: 700,
                    paidBy: 'p_suresh', // Payer is Suresh
                    splitType: 'custom',
                    participantShares: customShares
                }
            );

            await tripController.addTripExpense(req, res);
            assert.strictEqual(getStatus(), 201, 'Custom split expense should return HTTP 201');
            const exp = getData();
            customExpenseId = exp._id;
            assert.strictEqual(exp.splitType, 'custom');
            assert.strictEqual(exp.amount, 700);
            assert.strictEqual(exp.paidBy, 'p_suresh');
            assert.strictEqual(exp.createdByUserId.toString(), users.sharan._id.toString());
            assert.strictEqual(exp.participantShares.length, 4);

            // Fetch and calculate trip
            const expenses = await TripExpense.find({ tripId: testTrip._id });
            const calc = calculateTrip(testTrip.participants, expenses, []);

            assert.strictEqual(calc.totalTripExpense, 700, 'Total trip expense should be ₹700');

            // Suresh: paid 700, fair share 100 => Net balance +₹600
            assert.strictEqual(getNet(calc, 'p_suresh'), 600, 'Suresh net balance should be +₹600');
            // Sharan: paid 0, fair share 200 => Net balance -₹200
            assert.strictEqual(getNet(calc, 'p_sharan'), -200, 'Sharan net balance should be -₹200');
            // Thilak: paid 0, fair share 150 => Net balance -₹150
            assert.strictEqual(getNet(calc, 'p_thilak'), -150, 'Thilak net balance should be -₹150');
            // Kabilan: paid 0, fair share 250 => Net balance -₹250
            assert.strictEqual(getNet(calc, 'p_kabilan'), -250, 'Kabilan net balance should be -₹250');

            // Zero-sum invariant
            const sumNet = calc.participantSummary.reduce((s, p) => s + p.netBalance, 0);
            assert.strictEqual(sumNet, 0, 'Sum of all net balances must equal exactly 0');

            // Pairwise debts
            assert.strictEqual(calc.pairwiseDebts.length, 3, 'Should have 3 pairwise debts (all owed to Suresh)');
            const debtMap = {};
            calc.pairwiseDebts.forEach(d => {
                debtMap[`${d.fromId}->${d.toId}`] = d.amount;
            });

            assert.strictEqual(debtMap['p_sharan->p_suresh'], 200, 'Sharan should owe Suresh ₹200');
            assert.strictEqual(debtMap['p_thilak->p_suresh'], 150, 'Thilak should owe Suresh ₹150');
            assert.strictEqual(debtMap['p_kabilan->p_suresh'], 250, 'Kabilan should owe Suresh ₹250');

            console.log('  ✅ TEST 2 PASSED: Custom Amount Split calculated exact debts and zero-sum balances.\n');
        }

        // ---------------------------------------------------------------------
        // STEP 4: TEST 3 — VALIDATION & REJECTION OF MISMATCHED SUMS & INVALID AMOUNTS
        // ---------------------------------------------------------------------
        console.log('▶ STEP 4: Testing Rejection of Mismatched Sums & Invalid Inputs...');
        {
            // Case 1: Under-allocated (sum 650 < 700)
            const underAllocated = [
                { participantId: 'p_sharan', amount: 200 },
                { participantId: 'p_suresh', amount: 100 },
                { participantId: 'p_thilak', amount: 150 },
                { participantId: 'p_kabilan', amount: 200 } // total 650
            ];
            const { req: req1, res: res1, getStatus: getStatus1, getData: getData1 } = createMockReqRes(
                users.sharan, testTrip,
                { description: 'Under test', amount: 700, paidBy: 'p_suresh', splitType: 'custom', participantShares: underAllocated }
            );
            await tripController.addTripExpense(req1, res1);
            assert.strictEqual(getStatus1(), 400, 'Under-allocated custom split should return HTTP 400');
            assert(getData1().error.includes('less than') || getData1().error.includes('50.00'), 'Error message should clearly state the difference');

            // Case 2: Over-allocated (sum 750 > 700)
            const overAllocated = [
                { participantId: 'p_sharan', amount: 200 },
                { participantId: 'p_suresh', amount: 100 },
                { participantId: 'p_thilak', amount: 150 },
                { participantId: 'p_kabilan', amount: 300 } // total 750
            ];
            const { req: req2, res: res2, getStatus: getStatus2, getData: getData2 } = createMockReqRes(
                users.sharan, testTrip,
                { description: 'Over test', amount: 700, paidBy: 'p_suresh', splitType: 'custom', participantShares: overAllocated }
            );
            await tripController.addTripExpense(req2, res2);
            assert.strictEqual(getStatus2(), 400, 'Over-allocated custom split should return HTTP 400');
            assert(getData2().error.includes('greater than') || getData2().error.includes('50.00'), 'Error message should clearly state the difference');

            // Case 3: Negative amount
            const negativeShares = [
                { participantId: 'p_sharan', amount: -50 },
                { participantId: 'p_suresh', amount: 750 }
            ];
            const { req: req3, res: res3, getStatus: getStatus3 } = createMockReqRes(
                users.sharan, testTrip,
                { description: 'Negative test', amount: 700, paidBy: 'p_suresh', splitType: 'custom', participantShares: negativeShares }
            );
            await tripController.addTripExpense(req3, res3);
            assert.strictEqual(getStatus3(), 400, 'Negative shares should return HTTP 400');

            // Case 4: Invalid participant ID
            const invalidParticipantShares = [
                { participantId: 'p_non_existent', amount: 700 }
            ];
            const { req: req4, res: res4, getStatus: getStatus4 } = createMockReqRes(
                users.sharan, testTrip,
                { description: 'Invalid participant test', amount: 700, paidBy: 'p_suresh', splitType: 'custom', participantShares: invalidParticipantShares }
            );
            await tripController.addTripExpense(req4, res4);
            assert.strictEqual(getStatus4(), 400, 'Invalid participant should return HTTP 400');

            console.log('  ✅ TEST 3 PASSED: Validation bounds strictly enforced.\n');
        }

        // ---------------------------------------------------------------------
        // STEP 5: TEST 4 — SINGLE RECORD IN LEDGER & IDENTICAL SYNC ACROSS MEMBERS
        // ---------------------------------------------------------------------
        console.log('▶ STEP 5: Testing Single Expense Recording and Multi-User Visibility...');
        {
            const count = await TripExpense.countDocuments({ tripId: testTrip._id });
            assert.strictEqual(count, 1, 'Exactly one expense should exist in the ledger');

            // Query getTripDetails as each of the 4 accepted members
            for (const key of ['sharan', 'suresh', 'thilak', 'kabilan']) {
                const { req, res, getStatus, getData } = createMockReqRes(
                    users[key],
                    testTrip
                );
                await tripController.getTripDetails(req, res);
                assert.strictEqual(getStatus(), 200, `Member ${key} should access trip details`);
                const details = getData();
                assert.strictEqual(details.expenses.length, 1, `Member ${key} should see exactly 1 expense`);
                assert.strictEqual(details.totalTripExpense, 700, `Member ${key} should see total expense ₹700`);
                assert.strictEqual(details.pairwiseDebts.length, 3, `Member ${key} should see identical pairwise debts`);
            }

            console.log('  ✅ TEST 4 PASSED: Single expense correctly synchronized across all members.\n');
        }

        // ---------------------------------------------------------------------
        // STEP 6: TEST 5 — RECORD DIRECT SETTLEMENT PAYMENT
        // Sharan settles his debt to Suresh by paying ₹200.
        // Sharan debt to Suresh drops to ₹0.
        // Suresh net balance drops from +₹600 to +₹400.
        // ---------------------------------------------------------------------
        console.log('▶ STEP 6: Testing Settlement Payment on Custom Split Debts...');
        {
            const { req, res, getStatus, getData } = createMockReqRes(
                users.sharan,
                testTrip,
                {
                    fromParticipantId: 'p_sharan',
                    toParticipantId: 'p_suresh',
                    amount: 200,
                    notes: 'Paid ₹200 via UPI'
                }
            );

            await tripController.recordTripSettlement(req, res);
            assert.strictEqual(getStatus(), 201, 'Settlement should return HTTP 201');

            const expenses = await TripExpense.find({ tripId: testTrip._id });
            const settlements = await TripSettlement.find({ tripId: testTrip._id });
            const calc = calculateTrip(testTrip.participants, expenses, settlements);

            assert.strictEqual(getNet(calc, 'p_sharan'), 0, 'Sharan net balance should now be ₹0 (fully settled)');
            assert.strictEqual(getNet(calc, 'p_suresh'), 400, 'Suresh net balance should now be +₹400');
            assert.strictEqual(calc.pairwiseDebts.length, 2, 'Only Thilak and Kabilan should owe Suresh now');

            console.log('  ✅ TEST 5 PASSED: Settlement payment successfully applied to custom debt.\n');
        }

        // ---------------------------------------------------------------------
        // STEP 7: TEST 6 — PERSONAL FINANCIAL ISOLATION INVARIANT
        // ---------------------------------------------------------------------
        console.log('▶ STEP 7: Verifying Personal Financial Isolation Invariant...');
        {
            // Verify no personal transactions exist for any user
            const txCount = await Transaction.countDocuments({
                userId: { $in: Object.values(users).map(u => u._id) }
            });
            assert.strictEqual(txCount, 0, 'Zero personal transactions must be created by group trip expenses or settlements');

            // Verify opening balances remain completely untouched
            for (const cfg of accountConfigs) {
                const refreshed = await User.findById(users[cfg.key]._id);
                assert.strictEqual(refreshed.openingBalance, cfg.openingBalance, `User ${cfg.name} openingBalance must remain untouched`);
            }

            console.log('  ✅ TEST 6 PASSED: Personal financial records remain 100% isolated.\n');
        }

        console.log('🎉 ALL CUSTOM AMOUNT SPLIT TESTS PASSED 100%!\n');

    } finally {
        console.log('🧹 Cleaning up test documents...');
        if (testTrip) {
            await Trip.deleteOne({ _id: testTrip._id });
            await TripMember.deleteMany({ tripId: testTrip._id });
            await TripExpense.deleteMany({ tripId: testTrip._id });
            await TripSettlement.deleteMany({ tripId: testTrip._id });
        }
        await User.deleteMany({ _id: { $in: Object.values(users).map(u => u._id) } });
        await mongoose.disconnect();
        console.log('✅ Cleanup complete. Database restored.');
    }
}

run().catch(err => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
});
