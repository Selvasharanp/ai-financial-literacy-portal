// server/tests/locationBudgetAdvisor.test.js
// Verification suite for Location-Based Budget Advisor

const assert = require('assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { calculateLocationBudgetAdvice, resolveLocationBenchmark } = require('../services/locationBudgetService');
const locationBudgetController = require('../controllers/locationBudgetController');

console.log('🧪 RUNNING LOCATION-BASED BUDGET ADVISOR VERIFICATION SUITE...\n');

function createMockReqRes(user, body = {}, params = {}, query = {}) {
  const req = {
    user: user ? { id: user._id.toString(), email: user.email, name: user.name } : null,
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
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB.\n');

  const testUser = await User.create({
    name: `LocTest_${Date.now()}`,
    email: `loctest_${Date.now()}@example.com`,
    password: 'hashedPassword123',
    income: 45000,
    hasCompletedOnboarding: true
  });

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Location Resolution & PIN Code Matching
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Location Resolution & PIN Code Matching ---');
    {
      const bgl = resolveLocationBenchmark('Bengaluru');
      assert.strictEqual(bgl.resolvedCity, 'Bengaluru');
      assert.strictEqual(bgl.isSufficientData, true);
      assert.strictEqual(bgl.data.costIndex, 1.25);

      const tenkasi = resolveLocationBenchmark('Tenkasi');
      assert.strictEqual(tenkasi.resolvedCity, 'Tenkasi');
      assert.strictEqual(tenkasi.isSufficientData, true);
      assert.strictEqual(tenkasi.data.costIndex, 0.65);

      const pinTenkasi = resolveLocationBenchmark('627811');
      assert.ok(pinTenkasi.resolvedCity.includes('Tenkasi'));
      assert.strictEqual(pinTenkasi.isSufficientData, true);

      const pinBlr = resolveLocationBenchmark('560001');
      assert.ok(pinBlr.resolvedCity.includes('Bengaluru'));
      assert.strictEqual(pinBlr.isSufficientData, true);

      console.log('✅ Correctly resolved cities and PIN codes to regional cost benchmarks.');
    }

    // ------------------------------------------------------------------------
    // TEST 2: Bengaluru vs Tenkasi Cost Differences
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Bengaluru vs Tenkasi Budget Comparison (₹2,000 for 5 days) ---');
    {
      const blrAdvice = await calculateLocationBudgetAdvice({
        location: 'Bengaluru',
        availableAmount: 2000,
        days: 5,
        needs: { includeFood: true, includeTransport: true, includeAccommodation: false }
      });

      const tenkasiAdvice = await calculateLocationBudgetAdvice({
        location: 'Tenkasi',
        availableAmount: 2000,
        days: 5,
        needs: { includeFood: true, includeTransport: true, includeAccommodation: false }
      });

      console.log(`Bengaluru 5-day essential cost: ₹${blrAdvice.totalEssentialCost}, Status: ${blrAdvice.status}`);
      console.log(`Tenkasi 5-day essential cost: ₹${tenkasiAdvice.totalEssentialCost}, Status: ${tenkasiAdvice.status}`);

      // Bengaluru essential cost = (380 + 140) * 5 = ₹2,600 > ₹2,000 => INSUFFICIENT
      assert.strictEqual(blrAdvice.status, 'insufficient', 'Expected Bengaluru to be insufficient for ₹2,000/5 days');
      assert.ok(blrAdvice.surplusOrShortfall < 0, 'Expected negative shortfall for Bengaluru');
      assert.strictEqual(blrAdvice.surplusOrShortfall, -600, 'Expected ₹600 shortfall in Bengaluru');

      // Tenkasi essential cost = (160 + 45) * 5 = ₹1,025 < ₹2,000 => SUFFICIENT
      assert.strictEqual(tenkasiAdvice.status, 'sufficient', 'Expected Tenkasi to be sufficient for ₹2,000/5 days');
      assert.ok(tenkasiAdvice.surplusOrShortfall > 0, 'Expected positive surplus for Tenkasi');

      // Bengaluru cost index should be higher than Tenkasi
      assert.ok(blrAdvice.costIndex > tenkasiAdvice.costIndex);
      console.log('✅ Real-world cost difference strictly validated: Bengaluru vs Tenkasi.');
    }

    // ------------------------------------------------------------------------
    // TEST 3: Insufficient Budget & Recommendations
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Insufficient Budget Handling & 3 Practical Recommendations ---');
    {
      const insufficientAdvice = await calculateLocationBudgetAdvice({
        location: 'Bengaluru',
        availableAmount: 500,
        days: 5,
        needs: { includeFood: true, includeTransport: true, includeAccommodation: false }
      });

      assert.strictEqual(insufficientAdvice.status, 'insufficient');
      assert.strictEqual(insufficientAdvice.surplusOrShortfall, -2100);
      assert.ok(Array.isArray(insufficientAdvice.recommendations));
      assert.strictEqual(insufficientAdvice.recommendations.length, 3);
      console.log('Recommendations:');
      insufficientAdvice.recommendations.forEach((r, idx) => console.log(`  ${idx + 1}. ${r}`));

      // Verify recommendations do not tell user to skip food or basic travel
      insufficientAdvice.recommendations.forEach(r => {
        assert.ok(!r.toLowerCase().includes('skip food') && !r.toLowerCase().includes('skip eating'));
      });
      console.log('✅ Insufficient budget handled with realistic non-cutting recommendations.');
    }

    // ------------------------------------------------------------------------
    // TEST 4: Missing Local Cost Data / Uncertainty
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Missing Local Cost Data / Uncertainty ---');
    {
      const uncertainAdvice = await calculateLocationBudgetAdvice({
        location: 'UnknownRemoteVillageX999',
        availableAmount: 2000,
        days: 5,
        needs: { includeFood: true, includeTransport: true }
      });

      assert.strictEqual(uncertainAdvice.status, 'uncertain');
      assert.strictEqual(uncertainAdvice.isSufficientData, false);
      assert.ok(uncertainAdvice.statusMessage.toLowerCase().includes('limited') || uncertainAdvice.statusMessage.toLowerCase().includes('uncertain'));
      assert.strictEqual(uncertainAdvice.estimationDetails.confidence, 'uncertain');
      assert.strictEqual(uncertainAdvice.estimationDetails.isApproximated, true);
      console.log('Uncertainty message:', uncertainAdvice.statusMessage);
      console.log('✅ Correctly reports uncertainty when local cost data is unlisted.');
    }

    // ------------------------------------------------------------------------
    // TEST 5: Controller API Validation & Error Handling
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Controller API Validation & Input Sanitization ---');
    {
      // Missing location
      const { req: r1, res: s1, getStatus: gs1 } = createMockReqRes(testUser, { availableAmount: 1000, days: 3 });
      await locationBudgetController.getAdvice(r1, s1);
      assert.strictEqual(gs1(), 400);

      // Negative amount
      const { req: r2, res: s2, getStatus: gs2 } = createMockReqRes(testUser, { location: 'Chennai', availableAmount: -50, days: 3 });
      await locationBudgetController.getAdvice(r2, s2);
      assert.strictEqual(gs2(), 400);

      // Invalid days
      const { req: r3, res: s3, getStatus: gs3 } = createMockReqRes(testUser, { location: 'Chennai', availableAmount: 1000, days: 0 });
      await locationBudgetController.getAdvice(r3, s3);
      assert.strictEqual(gs3(), 400);

      console.log('✅ Controller strictly rejects invalid inputs with HTTP 400.');
    }

    // ------------------------------------------------------------------------
    // TEST 6: Geolocation Reverse Geocode Fallback (Denied Permission Simulation)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Reverse Geocode Endpoint & Fallback ---');
    {
      const { req, res, getStatus, getData } = createMockReqRes(testUser, { latitude: 12.9716, longitude: 77.5946 });
      await locationBudgetController.detectLocation(req, res);
      assert.strictEqual(getStatus(), 200);
      const data = getData();
      assert.ok(data.location, 'Expected location in response');
      console.log('Detected Location:', data.location, data.region);
      console.log('✅ Geolocation detection endpoint responds cleanly.');
    }

    // ------------------------------------------------------------------------
    // TEST 7: Isolation Invariant - User Accounts & Transactions Untouched
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Personal Account Isolation Invariant ---');
    {
      const initialTxCount = await Transaction.countDocuments({ userId: testUser._id });
      assert.strictEqual(initialTxCount, 0);

      // Call advice endpoint multiple times
      const { req, res } = createMockReqRes(testUser, {
        location: 'Bengaluru',
        availableAmount: 5000,
        days: 7,
        needs: { includeFood: true, includeTransport: true, includeAccommodation: true }
      });
      await locationBudgetController.getAdvice(req, res);

      const finalTxCount = await Transaction.countDocuments({ userId: testUser._id });
      assert.strictEqual(finalTxCount, 0, 'Transactions count must not change');

      const userAfter = await User.findById(testUser._id);
      assert.strictEqual(userAfter.income, 45000, 'User profile must remain unchanged');
      console.log('✅ Personal account isolation 100% verified: Zero database side-effects.');
    }

    console.log('\n======================================================');
    console.log('🎉 ALL 7 LOCATION BUDGET ADVISOR TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    await User.deleteOne({ _id: testUser._id });
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
