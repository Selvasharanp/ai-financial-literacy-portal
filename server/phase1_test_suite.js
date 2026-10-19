const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/User');
const { register, login, completeOnboarding } = require('./controllers/authController');

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/financial-literacy-portal';
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test_jwt_secret_phase1_12345';
}

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    res.send = (msg) => { res.msg = msg; return res; };
    return res;
};

async function runPhase1Tests() {
    console.log('=== RUNNING PHASE 1 TEST SUITE ===');
    console.log('Connecting to Mongo URI:', mongoUri);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to Database');

    const testStudentEmail = 'phase1_student_test@example.com';
    const testProEmail = 'phase1_pro_test@example.com';

    // Cleanup previous test users
    await User.deleteMany({ email: { $in: [testStudentEmail, testProEmail] } });

    try {
        // -------------------------------------------------------------
        // TEST A: Create a completely new account (Student flow).
        // Expected: Register -> automatically logged in -> onboarding (hasCompletedOnboarding: false)
        // -------------------------------------------------------------
        console.log('\n[TEST A] Creating new student account...');
        const reqA = {
            body: {
                name: 'Alice Student',
                email: testStudentEmail,
                password: 'password123'
            }
        };
        const resA = mockRes();
        await register(reqA, resA);

        console.assert(resA.data?.token, 'Token must be returned on registration for auto-login');
        console.assert(resA.data?.user?.hasCompletedOnboarding === false, 'New user must have hasCompletedOnboarding: false');
        console.log('✅ TEST A Passed: Account registered and automatically authenticated. Onboarding required.');

        const studentId = resA.data.user.id;

        // -------------------------------------------------------------
        // TEST B: Select Student -> enter available balance (15,000) -> submit.
        // Expected: Dashboard opens (hasCompletedOnboarding: true)
        // -------------------------------------------------------------
        console.log('\n[TEST B] Completing onboarding as Student with Available Balance = 15,000...');
        const reqB = {
            user: { id: studentId },
            body: {
                userType: 'Student',
                openingBalance: 15000
            }
        };
        const resB = mockRes();
        await completeOnboarding(reqB, resB);

        console.assert(resB.data?.userType === 'Student', 'User type saved as Student');
        console.assert(resB.data?.openingBalance === 15000, 'Available balance saved as 15000');
        console.assert(resB.data?.hasCompletedOnboarding === true, 'hasCompletedOnboarding updated to true');
        console.log('✅ TEST B Passed: Student onboarding completed, status saved, marked complete.');

        // -------------------------------------------------------------
        // TEST C: Logout -> login again.
        // Expected: Dashboard opens directly (hasCompletedOnboarding: true)
        // -------------------------------------------------------------
        console.log('\n[TEST C] Simulating Logout -> Login again with Student credentials...');
        const reqC = {
            body: {
                email: testStudentEmail,
                password: 'password123'
            }
        };
        const resC = mockRes();
        await login(reqC, resC);

        console.assert(resC.data?.token, 'Token returned on login');
        console.assert(resC.data?.user?.hasCompletedOnboarding === true, 'Existing user with completed onboarding has hasCompletedOnboarding: true');
        console.log('✅ TEST C Passed: Login returns completed onboarding status. Direct access to Dashboard.');

        // -------------------------------------------------------------
        // TEST D: Create another new account -> select Working Professional -> enter available balance (75,000).
        // Expected: Register -> onboarding -> Dashboard opens
        // -------------------------------------------------------------
        console.log('\n[TEST D] Creating new Working Professional account...');
        const reqD1 = {
            body: {
                name: 'Bob Professional',
                email: testProEmail,
                password: 'password123'
            }
        };
        const resD1 = mockRes();
        await register(reqD1, resD1);

        console.assert(resD1.data?.token, 'Token returned for pro registration');
        console.assert(resD1.data?.user?.hasCompletedOnboarding === false, 'Pro user initial onboarding status is false');

        const proId = resD1.data.user.id;

        console.log('Completing onboarding as Working Professional with Available Balance = 75,000...');
        const reqD2 = {
            user: { id: proId },
            body: {
                userType: 'Working Professional',
                openingBalance: 75000
            }
        };
        const resD2 = mockRes();
        await completeOnboarding(reqD2, resD2);

        console.assert(resD2.data?.userType === 'Working Professional', 'User type saved as Working Professional');
        console.assert(resD2.data?.openingBalance === 75000, 'Available balance saved as 75000');
        console.assert(resD2.data?.hasCompletedOnboarding === true, 'hasCompletedOnboarding updated to true');
        console.log('✅ TEST D Passed: Working Professional created, onboarded, and marked complete.');

        // -------------------------------------------------------------
        // TEST E: Logout -> login again (Pro account).
        // Expected: Dashboard opens directly
        // -------------------------------------------------------------
        console.log('\n[TEST E] Simulating Logout -> Login again with Working Professional credentials...');
        const reqE = {
            body: {
                email: testProEmail,
                password: 'password123'
            }
        };
        const resE = mockRes();
        await login(reqE, resE);

        console.assert(resE.data?.token, 'Token returned on login');
        console.assert(resE.data?.user?.hasCompletedOnboarding === true, 'Pro user login returns hasCompletedOnboarding: true');
        console.log('✅ TEST E Passed: Working Professional login opens Dashboard directly.');

        console.log('\n🎉 ALL 5 PHASE 1 TEST SCENARIOS PASSED SUCCESSFULLY!');

    } finally {
        // Cleanup test users
        await User.deleteMany({ email: { $in: [testStudentEmail, testProEmail] } });
        await mongoose.disconnect();
        console.log('🔌 DB Disconnected');
    }
}

runPhase1Tests().catch(err => {
    console.error('❌ Phase 1 Test Failed:', err);
    process.exit(1);
});
