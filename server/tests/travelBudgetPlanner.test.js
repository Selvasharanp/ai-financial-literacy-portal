const assert = require('assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TravelPlan = require('../models/TravelPlan');
const travelPlannerService = require('../services/travelPlannerService');
const travelPlannerController = require('../controllers/travelPlannerController');

console.log('🧪 RUNNING AI TRAVEL BUDGET PLANNER COMPREHENSIVE TEST SUITE...\n');

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
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        console.error('MONGO_URI is not defined in server/.env');
        process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB for Travel Budget Planner Verification.\n');

    const prefix = `travel_test_${Date.now()}_`;
    let user1 = null;
    let user2 = null;
    const createdPlanIds = [];

    try {
        // Setup two test users
        user1 = await User.create({
            name: `${prefix}Arun`,
            email: `${prefix}arun@example.com`,
            password: 'hashedPassword123',
            openingBalance: 25000,
            monthlyIncome: 60000,
            hasCompletedOnboarding: true
        });

        user2 = await User.create({
            name: `${prefix}Priya`,
            email: `${prefix}priya@example.com`,
            password: 'hashedPassword123',
            openingBalance: 30000,
            monthlyIncome: 75000,
            hasCompletedOnboarding: true
        });

        console.log(`✅ Test users created: ${user1.email} and ${user2.email}\n`);

        // ---------------------------------------------------------------------
        // SCENARIO A: 2-Day Trip, 2 Travellers (e.g. Sathyamangalam / Ooty)
        // ---------------------------------------------------------------------
        console.log('▶ SCENARIO A: 2-Day Trip, 2 Travellers, Budget Verification...');
        {
            const inputA = {
                origin: 'Coimbatore',
                destination: 'Ooty',
                departureDate: '2026-11-01',
                returnDate: '2026-11-02',
                durationDays: 2,
                numberOfTravellers: 2,
                totalBudget: 12000,
                travelStyle: 'budget'
            };

            const planA = await travelPlannerService.generateTripPlan(inputA);
            assert(planA, 'Plan A should be generated');
            assert(planA.planData, 'Plan A must contain structured planData');
            assert(planA.calculations, 'Plan A must contain calculations');

            const calcs = planA.calculations;
            console.log(`   Destination: ${inputA.destination}, Travellers: ${calcs.numberOfTravellers}, Nights: ${calcs.nights}`);
            console.log(`   Rooms Needed: ${calcs.roomsNeeded} (Expected 1 for 2 pax)`);
            assert.strictEqual(calcs.numberOfTravellers, 2, 'Travellers should be 2');
            assert.strictEqual(calcs.roomsNeeded, 1, 'Math.ceil(2/2) should require 1 room');
            assert.strictEqual(calcs.nights, 1, '2-day trip should have 1 night stay');

            // Verify strict deterministic math invariant:
            const expectedSumBeforeContingency =
                calcs.transportationTotal +
                calcs.accommodationTotal +
                calcs.mealsTotal +
                calcs.activitiesTotal +
                calcs.localTravelTotal +
                calcs.miscellaneousTotal;

            assert.strictEqual(
                calcs.expectedSpendingBeforeContingency,
                expectedSumBeforeContingency,
                'expectedSpendingBeforeContingency must equal sum of all 6 components'
            );

            assert.strictEqual(
                calcs.totalTripCost,
                expectedSumBeforeContingency + calcs.contingencyReserve,
                'totalTripCost must strictly equal spending before contingency + contingencyReserve'
            );

            assert.strictEqual(
                calcs.costPerPerson,
                Math.round(calcs.totalTripCost / 2),
                'costPerPerson must equal totalTripCost / 2'
            );

            assert.strictEqual(
                calcs.remainingBudget,
                12000 - calcs.totalTripCost,
                'remainingBudget must equal totalBudget - totalTripCost'
            );

            console.log(`   Total Cost: ₹${calcs.totalTripCost}, Cost/Person: ₹${calcs.costPerPerson}, Contingency: ₹${calcs.contingencyReserve}`);
            console.log('  ✅ SCENARIO A PASSED: Deterministic calculation invariant verified.\n');
        }

        // ---------------------------------------------------------------------
        // SCENARIO B: 3-Day Trip, 4 Travellers Group Trip (Goa)
        // ---------------------------------------------------------------------
        console.log('▶ SCENARIO B: 3-Day Trip, 4 Travellers Group Breakdown (Goa)...');
        {
            const inputB = {
                origin: 'Bangalore',
                destination: 'Goa',
                departureDate: '2026-11-10',
                returnDate: '2026-11-12',
                durationDays: 3,
                numberOfTravellers: 4,
                totalBudget: 40000,
                travelStyle: 'balanced'
            };

            const planB = await travelPlannerService.generateTripPlan(inputB);
            const calcs = planB.calculations;
            const pData = planB.planData;

            console.log(`   Duration: 3 Days, Travellers: ${calcs.numberOfTravellers}, Nights: ${calcs.nights}`);
            console.log(`   Rooms Needed: ${calcs.roomsNeeded} (Expected 2 rooms for 4 travellers)`);
            assert.strictEqual(calcs.roomsNeeded, 2, '4 travellers must require 2 rooms');
            assert.strictEqual(calcs.nights, 2, '3-day trip requires 2 nights accommodation');

            // Total room-nights = 2 rooms * 2 nights = 4 room-nights
            const roomRate = calcs.selectedAccommodation.pricePerNight;
            assert.strictEqual(calcs.accommodationTotal, roomRate * 2 * 2, 'Accommodation total must equal roomRate * 2 rooms * 2 nights');

            // Verify Itinerary has 3 days
            assert(Array.isArray(pData.itinerary), 'Itinerary must be an array');
            assert.strictEqual(pData.itinerary.length, 3, 'Itinerary must have 3 days');

            // Verify each day has schedule slots and meals
            pData.itinerary.forEach((day, idx) => {
                assert.strictEqual(day.dayNumber, idx + 1, `Day number must be ${idx + 1}`);
                assert(day.meals, `Day ${idx + 1} must include meals breakdown`);
                assert(day.schedule, `Day ${idx + 1} must include schedule`);
                assert(day.activities, `Day ${idx + 1} must include activities`);
            });

            console.log(`   Total Cost: ₹${calcs.totalTripCost}, Cost/Person: ₹${calcs.costPerPerson}`);
            console.log('  ✅ SCENARIO B PASSED: 4-traveller multi-day group breakdown verified.\n');
        }

        // ---------------------------------------------------------------------
        // SCENARIO C: Over-Budget Detection, Suggestions & Deterministic Recalculation
        // ---------------------------------------------------------------------
        console.log('▶ SCENARIO C: Over-Budget Detection & Interactive Recalculation...');
        {
            const inputC = {
                origin: 'Chennai',
                destination: 'Ooty',
                departureDate: '2026-12-01',
                returnDate: '2026-12-03',
                durationDays: 3,
                numberOfTravellers: 3,
                totalBudget: 6000, // Very low budget to trigger over-budget
                travelStyle: 'comfortable'
            };

            const planC = await travelPlannerService.generateTripPlan(inputC);
            const calcs = planC.calculations;

            assert.strictEqual(calcs.isOverBudget, true, 'Plan must be detected as over budget');
            assert(calcs.shortfall > 0, 'Shortfall must be positive');
            assert(Array.isArray(planC.suggestions) && planC.suggestions.length > 0, 'Must provide budget optimization suggestions');

            console.log(`   Budget: ₹6,000 | Calculated Total: ₹${calcs.totalTripCost} | Shortfall: +₹${calcs.shortfall}`);
            console.log(`   Generated ${planC.suggestions.length} optimization suggestions.`);

            // Test Deterministic Recalculation without AI:
            // Let's change transport option to index 0 (cheapest bus/sleeper) or adjust contingency percent to 5%
            const initialTotal = calcs.totalTripCost;
            const updatedRecalc = travelPlannerService.calculateTripPlanTotals(
                planC.planData,
                { transportIndex: 0, accommodationIndex: 0, activitySelections: [], customContingencyPercent: 5 },
                planC.inputs
            );

            assert(updatedRecalc.totalTripCost < initialTotal, 'Selecting budget options and deselecting paid activities must reduce total cost');
            assert.strictEqual(updatedRecalc.contingencyPercent, 5, 'Contingency percent must be updated to 5%');
            assert.strictEqual(updatedRecalc.activitiesTotal, 0, 'Activities total must be 0 when no activities selected');

            console.log(`   Recalculated Total after optimization: ₹${updatedRecalc.totalTripCost} (Saved ₹${initialTotal - updatedRecalc.totalTripCost})`);
            console.log('  ✅ SCENARIO C PASSED: Over-budget handling and deterministic recalculation verified.\n');
        }

        // ---------------------------------------------------------------------
        // SCENARIO D: Transparency & Confidence Labels
        // ---------------------------------------------------------------------
        console.log('▶ SCENARIO D: Transparency & Estimation Confidence Labels...');
        {
            const testPlan = await travelPlannerService.generateTripPlan({
                origin: 'Sathyamangalam',
                destination: 'Ooty',
                departureDate: '2026-11-20',
                returnDate: '2026-11-21',
                durationDays: 2,
                numberOfTravellers: 2,
                totalBudget: 10000,
                travelStyle: 'balanced'
            });

            // Check transport confidence
            testPlan.planData.transportationOptions.forEach(opt => {
                assert(opt.mode, 'Transport must have mode');
                assert(opt.confidence || opt.bookingNotes, 'Transport must have confidence label or booking notes');
            });

            // Check accommodation confidence
            testPlan.planData.accommodationOptions.forEach(acc => {
                assert(acc.name, 'Stay must have name');
                assert(acc.pricePerNight > 0, 'Price per night must be > 0');
                assert(acc.confidence || acc.type, 'Stay must have confidence label or type');
            });

            console.log('  ✅ SCENARIO D PASSED: Transparency and estimation labels verified.\n');
        }

        // ---------------------------------------------------------------------
        // SCENARIO E: Input Validation & Edge Case Rejections
        // ---------------------------------------------------------------------
        console.log('▶ SCENARIO E: Input Validation & Error Boundaries...');
        {
            // 1. Missing Origin
            const val1 = travelPlannerService.validateTripInputs({
                origin: '',
                destination: 'Ooty',
                totalBudget: 10000,
                numberOfTravellers: 2
            });
            assert.strictEqual(val1.isValid, false, 'Missing origin must fail validation');

            // 2. Negative Budget
            const val2 = travelPlannerService.validateTripInputs({
                origin: 'Bangalore',
                destination: 'Goa',
                totalBudget: -500,
                numberOfTravellers: 2
            });
            assert.strictEqual(val2.isValid, false, 'Negative budget must fail validation');

            // 3. Return Date earlier than Departure Date
            const val3 = travelPlannerService.validateTripInputs({
                origin: 'Bangalore',
                destination: 'Goa',
                departureDate: '2026-11-15',
                returnDate: '2026-11-10',
                totalBudget: 15000,
                numberOfTravellers: 2
            });
            assert.strictEqual(val3.isValid, false, 'Return date earlier than departure must fail validation');

            // 4. Over 14 Days duration
            const val4 = travelPlannerService.validateTripInputs({
                origin: 'Bangalore',
                destination: 'Goa',
                departureDate: '2026-11-01',
                returnDate: '2026-11-20', // 20 days
                totalBudget: 15000,
                numberOfTravellers: 2
            });
            assert.strictEqual(val4.isValid, false, 'Trips longer than 14 days must fail validation');

            // 5. Zero Travellers
            const val5 = travelPlannerService.validateTripInputs({
                origin: 'Bangalore',
                destination: 'Goa',
                totalBudget: 15000,
                numberOfTravellers: 0
            });
            assert.strictEqual(val5.isValid, false, 'Zero travellers must fail validation');

            console.log('  ✅ SCENARIO E PASSED: All 5 validation edge cases cleanly caught.\n');
        }

        // ---------------------------------------------------------------------
        // SCENARIO F: Save Plan, Retrieve, User Isolation & Deletion
        // ---------------------------------------------------------------------
        console.log('▶ SCENARIO F: Saved Plans CRUD & Multi-User Isolation...');
        {
            // 1. User 1 saves a plan
            const planToSave = await travelPlannerService.generateTripPlan({
                origin: 'Bangalore',
                destination: 'Kodaikanal',
                departureDate: '2026-11-18',
                returnDate: '2026-11-20',
                durationDays: 3,
                numberOfTravellers: 2,
                totalBudget: 18000,
                travelStyle: 'balanced'
            });

            const { req: saveReq, res: saveRes, getData: getSaveData, getStatus: getSaveStatus } = createMockReqRes(
                user1,
                {
                    title: 'Bangalore to Kodaikanal Trip',
                    planData: planToSave.planData,
                    selectedOptions: planToSave.selectedOptions,
                    calculations: planToSave.calculations,
                    inputs: planToSave.inputs
                }
            );

            await travelPlannerController.savePlan(saveReq, saveRes);
            assert.strictEqual(getSaveStatus(), 201, 'Save plan must return 201 Created');
            const savedDoc = getSaveData().savedPlan;
            assert(savedDoc && savedDoc._id, 'Must return saved document with ID');
            createdPlanIds.push(savedDoc._id);

            // 2. User 1 retrieves their saved plans
            const { req: getReq1, res: getRes1, getData: getData1 } = createMockReqRes(user1);
            await travelPlannerController.getSavedPlans(getReq1, getRes1);
            const user1Plans = getData1().plans;
            assert(Array.isArray(user1Plans), 'User 1 plans must be an array');
            assert(user1Plans.some(p => p._id.toString() === savedDoc._id.toString()), 'User 1 must find their saved plan');

            // 3. User 2 attempts to retrieve User 1's saved plans -> Must NOT see User 1's plan
            const { req: getReq2, res: getRes2, getData: getData2 } = createMockReqRes(user2);
            await travelPlannerController.getSavedPlans(getReq2, getRes2);
            const user2Plans = getData2().plans;
            assert.strictEqual(
                user2Plans.some(p => p._id.toString() === savedDoc._id.toString()),
                false,
                'User 2 must NEVER see User 1 saved plans (strict multi-user isolation)'
            );

            // 4. User 2 directly requests User 1's plan ID -> 404 Not Found
            const { req: directReq2, res: directRes2, getStatus: directStatus2 } = createMockReqRes(user2, {}, { id: savedDoc._id });
            await travelPlannerController.getSavedPlanById(directReq2, directRes2);
            assert.strictEqual(directStatus2(), 404, 'User 2 accessing User 1 plan by ID must receive 404');

            // 5. User 1 deletes the plan
            const { req: delReq, res: delRes, getStatus: delStatus } = createMockReqRes(user1, {}, { id: savedDoc._id });
            await travelPlannerController.deleteSavedPlan(delReq, delRes);
            assert.strictEqual(delStatus(), 200, 'Delete saved plan must return 200');

            // Verify plan is removed from DB
            const checkDeleted = await TravelPlan.findById(savedDoc._id);
            assert.strictEqual(checkDeleted, null, 'Deleted plan must be removed from database');

            console.log('  ✅ SCENARIO F PASSED: Multi-user saved plans CRUD & strict isolation verified.\n');
        }

        // ---------------------------------------------------------------------
        // SCENARIO G: Personal Financial Isolation Invariant
        // ---------------------------------------------------------------------
        console.log('▶ SCENARIO G: Verifying Personal Financial Isolation Invariant...');
        {
            // Verify NO transactions were created for either test user
            const txCount = await Transaction.countDocuments({
                userId: { $in: [user1._id, user2._id] }
            });
            assert.strictEqual(txCount, 0, 'Zero personal transactions must be created during travel planning');

            // Verify opening balances and financial profiles remain completely untouched
            const refreshedU1 = await User.findById(user1._id);
            const refreshedU2 = await User.findById(user2._id);
            assert.strictEqual(refreshedU1.openingBalance, 25000, 'User 1 opening balance must remain 25000');
            assert.strictEqual(refreshedU2.openingBalance, 30000, 'User 2 opening balance must remain 30000');

            console.log('  ✅ SCENARIO G PASSED: Personal finance isolation invariant 100% intact.\n');
        }

        // ---------------------------------------------------------------------
        // SCENARIO H: Google Places API (New) Integration & Geographic Precision
        // ---------------------------------------------------------------------
        console.log('▶ SCENARIO H: Google Places API (New) Integration & Geographic Precision...');
        {
            // Test 1: Domestic Destination (Ooty)
            const ootyPlan = await travelPlannerService.generateTripPlan({
                origin: 'Coimbatore',
                destination: 'Ooty',
                departureDate: '2026-11-05',
                returnDate: '2026-11-06',
                durationDays: 2,
                numberOfTravellers: 2,
                totalBudget: 15000,
                travelStyle: 'balanced'
            });

            assert.strictEqual(ootyPlan.placesConfigured, true, 'placesConfigured must be true when GOOGLE_MAPS_API_KEY is present');
            assert(ootyPlan.verifiedPlacesCount > 0, 'verifiedPlacesCount should be > 0 for Ooty');

            // Verify Google Places data in accommodation
            const verifiedHotel = ootyPlan.planData.accommodationOptions.find(h => h.verifiedPlace);
            assert(verifiedHotel, 'Ooty plan should contain at least one Google Places verified hotel');
            assert(verifiedHotel.googleMapsUri, 'Verified hotel must have googleMapsUri');
            assert(verifiedHotel.formattedAddress, 'Verified hotel must have formatted address');
            console.log(`   Verified Ooty Hotel: ${verifiedHotel.name} (${verifiedHotel.formattedAddress}) [${verifiedHotel.googleMapsUri}]`);

            // Verify Google Places data in itinerary activities / meals
            const verifiedActivities = [];
            ootyPlan.planData.itinerary.forEach(day => {
                (day.activities || []).forEach(act => {
                    if (act.verifiedPlace) verifiedActivities.push(act);
                });
            });
            console.log(`   Verified Activities count: ${verifiedActivities.length}`);
            if (verifiedActivities.length > 0) {
                assert(verifiedActivities[0].googleMapsUri, 'Verified activity must have googleMapsUri');
            }

            // Test 2: Foreign/Unique Destination (Interlaken, Switzerland)
            const swissPlan = await travelPlannerService.generateTripPlan({
                origin: 'Zurich',
                destination: 'Interlaken, Switzerland',
                departureDate: '2026-11-15',
                returnDate: '2026-11-17',
                durationDays: 3,
                numberOfTravellers: 2,
                totalBudget: 150000,
                travelStyle: 'comfortable'
            });

            assert.strictEqual(swissPlan.placesConfigured, true, 'placesConfigured must be true for Switzerland');
            assert(swissPlan.verifiedPlacesCount > 0, 'verifiedPlacesCount should be > 0 for Interlaken, Switzerland');

            // Verify places belong to Switzerland, not Tamil Nadu
            const swissHotel = swissPlan.planData.accommodationOptions.find(h => h.verifiedPlace);
            if (swissHotel) {
                console.log(`   Verified Swiss Hotel: ${swissHotel.name} (${swissHotel.formattedAddress})`);
                assert(
                    swissHotel.formattedAddress?.toLowerCase().includes('switzerland') || 
                    swissHotel.formattedAddress?.toLowerCase().includes('interlaken') ||
                    swissHotel.formattedAddress?.toLowerCase().includes('schweiz') ||
                    swissHotel.formattedAddress?.toLowerCase().includes('suisse'),
                    'Swiss hotel address must match Switzerland/Interlaken geography'
                );
            }

            // Test 3: Key security invariant - GOOGLE_MAPS_API_KEY must not be exposed
            const planString = JSON.stringify(ootyPlan);
            assert(!planString.includes(process.env.GOOGLE_MAPS_API_KEY), 'GOOGLE_MAPS_API_KEY must never be leaked in plan payload');

            console.log('  ✅ SCENARIO H PASSED: Google Places API (New) real data & geographic precision verified.\n');
        }

        console.log('🎉 ALL TRAVEL BUDGET PLANNER TESTS COMPLETED SUCCESSFULLY!\n');

    } finally {
        console.log('🧹 Cleaning up test artifacts...');
        if (createdPlanIds.length > 0) {
            await TravelPlan.deleteMany({ _id: { $in: createdPlanIds } });
        }
        if (user1 || user2) {
            const uIds = [user1?._id, user2?._id].filter(Boolean);
            await TravelPlan.deleteMany({ userId: { $in: uIds } });
            await User.deleteMany({ _id: { $in: uIds } });
        }
        await mongoose.disconnect();
        console.log('✅ Cleanup finished and MongoDB disconnected.\n');
    }
}

run().catch(err => {
    console.error('❌ Test execution encountered error:', err);
    process.exit(1);
});
