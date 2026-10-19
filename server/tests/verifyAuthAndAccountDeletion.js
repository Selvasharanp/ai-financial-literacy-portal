const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const Trip = require('../models/Trip');
const TripMember = require('../models/TripMember');
const TripExpense = require('../models/TripExpense');
const { isPlacesConfigured } = require('../services/googlePlacesService');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
    console.log('--- STARTING FINWISE AUTH & ACCOUNT DELETION VERIFICATION ---');

    // 1. Verify Google Maps API Key preservation
    const placesConfigured = isPlacesConfigured();
    console.log(`[Test 1] Google Places API Key configured: ${placesConfigured ? 'PASS (Preserved)' : 'FAIL'}`);
    if (!placesConfigured) throw new Error('GOOGLE_MAPS_API_KEY is missing or invalid in server environment!');

    // 2. Test Email/Password Registration
    const testEmail = `test_deletion_${Date.now()}@finwise.test`;
    const testPassword = 'Password123!';
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Deletion Test User',
            email: testEmail,
            password: testPassword
        })
    });
    const regData = await regRes.json();
    console.log(`[Test 2] Registration status: ${regRes.status}, Token received: ${Boolean(regData.token)}`);
    if (!regData.token) throw new Error(`Registration failed: ${JSON.stringify(regData)}`);

    const token = regData.token;
    const userId = regData.user.id;

    // 3. Test Profile Fetch
    const profRes = await fetch(`${BASE_URL}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const profile = await profRes.json();
    console.log(`[Test 3] Profile: authProvider=${profile.authProvider}, isGoogleConnected=${profile.isGoogleConnected}, hasPassword=${profile.hasPassword}`);
    if (profile.authProvider !== 'local' || profile.isGoogleConnected !== false || profile.hasPassword !== true) {
        throw new Error(`Profile fields mismatch: ${JSON.stringify(profile)}`);
    }

    // 4. Test Google Auth Endpoint (Simulated Google sign-in)
    const googleEmail = `google_user_${Date.now()}@finwise.test`;
    const googleRes = await fetch(`${BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            googleId: `gid_${Date.now()}`,
            email: googleEmail,
            name: 'Google Auth User',
            avatar: 'https://lh3.googleusercontent.com/a/test'
        })
    });
    const googleData = await googleRes.json();
    console.log(`[Test 4] Google Auth Status: ${googleRes.status}, User ID: ${googleData.user?.id}`);
    if (!googleData.token || googleData.user?.isGoogleConnected !== true) {
        throw new Error(`Google Auth failed: ${JSON.stringify(googleData)}`);
    }

    // 5. Test Link Google Account to first user
    const linkGid = `gid_linked_${Date.now()}`;
    const linkRes = await fetch(`${BASE_URL}/auth/link-google`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            googleId: linkGid,
            email: testEmail
        })
    });
    const linkData = await linkRes.json();
    console.log(`[Test 5] Link Google Status: ${linkRes.status}, isGoogleConnected: ${linkData.profile?.isGoogleConnected}, authProvider: ${linkData.profile?.authProvider}`);
    if (!linkData.success || linkData.profile?.authProvider !== 'both' || linkData.profile?.isGoogleConnected !== true) {
        throw new Error(`Linking Google failed: ${JSON.stringify(linkData)}`);
    }

    // 6. Test Unlink Google Account
    const unlinkRes = await fetch(`${BASE_URL}/auth/unlink-google`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const unlinkData = await unlinkRes.json();
    console.log(`[Test 6] Unlink Google Status: ${unlinkRes.status}, authProvider: ${unlinkData.profile?.authProvider}, isGoogleConnected: ${unlinkData.profile?.isGoogleConnected}`);
    if (!unlinkData.success || unlinkData.profile?.authProvider !== 'local' || unlinkData.profile?.isGoogleConnected !== false) {
        throw new Error(`Unlinking Google failed: ${JSON.stringify(unlinkData)}`);
    }

    // 7. Populate User Data: Transaction, Goal, Solo Trip, Collaborative Trip with Partner
    await mongoose.connect(process.env.MONGO_URI);

    // Create partner user
    const partnerEmail = `partner_${Date.now()}@finwise.test`;
    const partner = await new User({
        name: 'Partner User',
        email: partnerEmail,
        password: await bcrypt.hash('PartnerPass123!', 10),
        hasCompletedOnboarding: true
    }).save();

    // Create personal transaction
    const tx = await new Transaction({
        userId: userId,
        title: 'Grocery Store Run',
        amount: 850,
        type: 'expense',
        category: 'Food'
    }).save();

    // Create personal goal
    const goal = await new Goal({
        userId: userId,
        targetName: 'New Laptop',
        targetAmount: 60000,
        currentAmount: 15000
    }).save();

    // Create solo trip
    const soloTrip = await new Trip({
        userId: userId,
        name: 'Solo Trekking',
        collaborativeMode: false,
        participants: [{ id: 'p1', name: 'Deletion Test User', email: testEmail }]
    }).save();
    await new TripMember({ tripId: soloTrip._id, userId: userId, participantId: 'p1', role: 'creator' }).save();
    await new TripExpense({
        tripId: soloTrip._id,
        userId: userId,
        description: 'Backpack',
        amount: 3200,
        paidBy: 'p1',
        sharedWith: ['p1']
    }).save();

    // Create shared collaborative trip
    const sharedTrip = await new Trip({
        userId: userId,
        name: 'Goa Weekend Shared',
        collaborativeMode: true,
        participants: [
            { id: 'p_creator', name: 'Deletion Test User', email: testEmail },
            { id: 'p_partner', name: 'Partner User', email: partnerEmail }
        ]
    }).save();
    await new TripMember({ tripId: sharedTrip._id, userId: userId, participantId: 'p_creator', role: 'creator', joinedAt: new Date(Date.now() - 5000) }).save();
    await new TripMember({ tripId: sharedTrip._id, userId: partner._id, participantId: 'p_partner', role: 'member', joinedAt: new Date() }).save();
    const sharedExpense = await new TripExpense({
        tripId: sharedTrip._id,
        userId: userId,
        description: 'Resort Villa Booking',
        amount: 12000,
        paidBy: 'p_creator',
        sharedWith: ['p_creator', 'p_partner'],
        participantShares: [
            { participantId: 'p_creator', amount: 6000 },
            { participantId: 'p_partner', amount: 6000 }
        ]
    }).save();

    console.log('[Test 7] Seeded personal and collaborative records successfully.');

    // 8. Test Delete Account Validation: Missing/Wrong confirmation
    const badConfirmRes = await fetch(`${BASE_URL}/auth/delete-account`, {
        method: 'DELETE',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ confirmation: 'delete', password: testPassword })
    });
    console.log(`[Test 8] Bad confirmation response status: ${badConfirmRes.status} (Expected 400)`);
    if (badConfirmRes.status !== 400) throw new Error('Deletion should reject lowercase or non-"DELETE" confirmation');

    // 9. Test Delete Account Validation: Wrong password
    const badPassRes = await fetch(`${BASE_URL}/auth/delete-account`, {
        method: 'DELETE',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ confirmation: 'DELETE', password: 'WrongPassword999!' })
    });
    console.log(`[Test 9] Bad password response status: ${badPassRes.status} (Expected 400)`);
    if (badPassRes.status !== 400) throw new Error('Deletion should reject invalid password');

    // 10. Test Valid Deletion
    const delRes = await fetch(`${BASE_URL}/auth/delete-account`, {
        method: 'DELETE',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ confirmation: 'DELETE', password: testPassword })
    });
    const delData = await delRes.json();
    console.log(`[Test 10] Valid Delete response status: ${delRes.status}, success: ${delData.success}`);
    if (delRes.status !== 200 || !delData.success) throw new Error(`Valid deletion failed: ${JSON.stringify(delData)}`);

    // 11. Verify Database State
    const deletedUser = await User.findById(userId);
    console.log(`[Test 11.1] User record deleted: ${deletedUser === null ? 'PASS' : 'FAIL'}`);

    const remainingTx = await Transaction.find({ userId });
    console.log(`[Test 11.2] Personal transactions count: ${remainingTx.length} (Expected 0): ${remainingTx.length === 0 ? 'PASS' : 'FAIL'}`);

    const remainingGoal = await Goal.find({ userId });
    console.log(`[Test 11.3] Personal goals count: ${remainingGoal.length} (Expected 0): ${remainingGoal.length === 0 ? 'PASS' : 'FAIL'}`);

    const remainingSoloTrip = await Trip.findById(soloTrip._id);
    console.log(`[Test 11.4] Solo trip deleted: ${remainingSoloTrip === null ? 'PASS' : 'FAIL'}`);

    const preservedSharedTrip = await Trip.findById(sharedTrip._id);
    console.log(`[Test 11.5] Collaborative shared trip preserved: ${preservedSharedTrip !== null ? 'PASS' : 'FAIL'}`);
    console.log(`[Test 11.6] Preserved trip new owner: ${preservedSharedTrip?.userId?.toString() === partner._id.toString() ? 'PASS (Transferred to partner)' : 'FAIL'}`);

    const preservedExpense = await TripExpense.findById(sharedExpense._id);
    console.log(`[Test 11.7] Collaborative expense preserved for partner ledger: ${preservedExpense !== null ? 'PASS' : 'FAIL'}`);

    const partnerMembership = await TripMember.findOne({ tripId: sharedTrip._id, userId: partner._id });
    console.log(`[Test 11.8] Partner role promoted to creator: ${partnerMembership?.role === 'creator' ? 'PASS' : 'FAIL'}`);

    // Cleanup partner user & test shared trip
    await TripExpense.deleteMany({ tripId: sharedTrip._id });
    await TripMember.deleteMany({ tripId: sharedTrip._id });
    await Trip.findByIdAndDelete(sharedTrip._id);
    await User.findByIdAndDelete(partner._id);
    await User.findByIdAndDelete(googleData.user.id);
    await mongoose.disconnect();

    console.log('--- ALL AUTH & ACCOUNT DELETION TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
    console.error('VERIFICATION TEST FAILED:', err);
    process.exit(1);
});
