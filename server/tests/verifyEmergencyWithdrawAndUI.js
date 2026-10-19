const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000';

async function req(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== FINWISE AI FUNCTIONAL & UI CONSISTENCY VERIFICATION ===\n');
  let testUserToken = null;

  // 1. Authentication
  console.log('Step 1: Authenticating test user...');
  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'suresh@example.com', password: 'password123' }
  });

  if (loginRes.ok && loginRes.data?.token) {
    testUserToken = loginRes.data.token;
    console.log('✅ Logged in successfully as Suresh Kumar.');
  } else {
    console.log('Test user login failed, attempting registration...');
    const regRes = await req('/api/auth/register', {
      method: 'POST',
      body: { name: 'Suresh Kumar', email: 'suresh@example.com', password: 'password123' }
    });
    if (regRes.ok && regRes.data?.token) {
      testUserToken = regRes.data.token;
      console.log('✅ Registered test user successfully.');
    } else {
      console.error('❌ Failed to authenticate:', regRes.data);
      process.exit(1);
    }
  }

  const authHeader = { Authorization: `Bearer ${testUserToken}` };

  // 2. Goal Creation & Setup
  console.log('\nStep 2: Setting up opening balance and creating / retrieving test goal pot...');
  
  // Ensure user has opening balance
  await req('/api/auth/profile', {
    method: 'PUT',
    headers: authHeader,
    body: {
      name: 'Suresh Kumar',
      location: 'Bengaluru',
      userType: 'Working Professional',
      openingBalance: 50000
    }
  });
  console.log('✅ Configured user profile opening balance: ₹50,000');

  let goalId = null;
  const initialGoalName = 'Emergency Cushion Test Pot';

  const goalsList = await req('/api/goals', { headers: authHeader });
  let existingGoal = Array.isArray(goalsList.data) ? goalsList.data.find(g => (g.name || g.targetName) === initialGoalName) : null;

  if (!existingGoal) {
    const createRes = await req('/api/goals', {
      method: 'POST',
      headers: authHeader,
      body: {
        name: initialGoalName,
        targetName: initialGoalName,
        targetAmount: 50000
      }
    });
    existingGoal = createRes.data;
    console.log(`✅ Created goal pot: "${existingGoal.name || existingGoal.targetName}" (ID: ${existingGoal._id})`);
  } else {
    console.log(`✅ Found existing goal pot: "${existingGoal.name || existingGoal.targetName}" (ID: ${existingGoal._id})`);
  }
  goalId = existingGoal._id;

  // Allocate funds to ensure there is a known starting balance (e.g. ₹5,000)
  console.log('Ensuring goal has starting funds...');
  const allocRes = await req(`/api/goals/${goalId}/allocate`, {
    method: 'POST',
    headers: authHeader,
    body: { amount: 5000 }
  });
  if (!allocRes.ok) {
    console.error('❌ Allocation failed:', allocRes.data);
    process.exit(1);
  }

  const updatedGoals = await req('/api/goals', { headers: authHeader });
  const refreshed = updatedGoals.data.find(g => g._id === goalId);
  console.log(`✅ Goal pot current amount: ₹${refreshed.currentAmount}`);

  // 3. Test Valid Emergency Fund Withdrawal
  console.log('\nStep 3: Testing Valid Emergency Fund Withdrawal...');
  const goalsBefore = await req('/api/goals', { headers: authHeader });
  const goalBefore = goalsBefore.data.find(g => g._id === goalId);
  const balanceBefore = goalBefore.currentAmount;
  const withdrawAmt = 1500;

  console.log(`Attempting to withdraw ₹${withdrawAmt} from goal with ₹${balanceBefore}...`);
  const withdrawRes = await req(`/api/goals/${goalId}/emergency-withdraw`, {
    method: 'POST',
    headers: authHeader,
    body: { amount: withdrawAmt }
  });

  if (withdrawRes.status === 200 && withdrawRes.data?.msg) {
    console.log(`✅ Withdrawal succeeded: "${withdrawRes.data.msg}"`);
    console.log(`✅ Returned availableBalance: ₹${withdrawRes.data.availableBalance}`);
    console.log(`✅ Returned remainingGoalAmount: ₹${withdrawRes.data.remainingGoalAmount}`);

    const goalsAfter = await req('/api/goals', { headers: authHeader });
    const goalAfter = goalsAfter.data.find(g => g._id === goalId);
    const expectedBalance = balanceBefore - withdrawAmt;

    if (goalAfter.currentAmount === expectedBalance) {
      console.log(`✅ Verification passed: Goal balance decreased from ₹${balanceBefore} to exactly ₹${goalAfter.currentAmount}.`);
    } else {
      console.error(`❌ Mismatch: Expected ₹${expectedBalance}, found ₹${goalAfter.currentAmount}`);
      process.exit(1);
    }
  } else {
    console.error('❌ Unexpected response structure:', withdrawRes);
    process.exit(1);
  }

  // 4. Test Validation: Excessive Amount (> available balance)
  console.log('\nStep 4: Testing Excessive Amount Validation (reject amount > currentAmount)...');
  const currentGoalCheck = await req('/api/goals', { headers: authHeader });
  const goalNow = currentGoalCheck.data.find(g => g._id === goalId);
  const excessiveAmt = (goalNow.currentAmount || 0) + 100000;

  console.log(`Current goal balance: ₹${goalNow.currentAmount}. Trying to withdraw: ₹${excessiveAmt}...`);
  const excessiveRes = await req(`/api/goals/${goalId}/emergency-withdraw`, {
    method: 'POST',
    headers: authHeader,
    body: { amount: excessiveAmt }
  });

  if (excessiveRes.status === 400) {
    console.log(`✅ Correctly rejected with HTTP 400: "${excessiveRes.data.error}"`);
  } else {
    console.error('❌ Expected HTTP 400 rejection, but got:', excessiveRes.status, excessiveRes.data);
    process.exit(1);
  }

  // 5. Test Validation: Negative or Zero Amount
  console.log('\nStep 5: Testing Zero/Negative Amount Validation...');
  for (const invalidAmt of [0, -250, 'abc']) {
    const invalidRes = await req(`/api/goals/${goalId}/emergency-withdraw`, {
      method: 'POST',
      headers: authHeader,
      body: { amount: invalidAmt }
    });

    if (invalidRes.status === 400) {
      console.log(`✅ Amount "${invalidAmt}" correctly rejected with HTTP 400: "${invalidRes.data.error}"`);
    } else {
      console.error(`❌ Amount ${invalidAmt} was not rejected:`, invalidRes.status, invalidRes.data);
      process.exit(1);
    }
  }

  // 6. Test Atomic Concurrency (Race Condition Defense)
  console.log('\nStep 6: Testing Atomic Concurrency & Race Condition Defense...');
  const currentGoals = await req('/api/goals', { headers: authHeader });
  const currentGoal = currentGoals.data.find(g => g._id === goalId);
  if (currentGoal.currentAmount > 3000) {
    await req(`/api/goals/${goalId}/emergency-withdraw`, {
      method: 'POST',
      headers: authHeader,
      body: { amount: currentGoal.currentAmount - 3000 }
    });
  } else if (currentGoal.currentAmount < 3000) {
    await req(`/api/goals/${goalId}/allocate`, {
      method: 'POST',
      headers: authHeader,
      body: { amount: 3000 - currentGoal.currentAmount }
    });
  }

  const readyGoals = await req('/api/goals', { headers: authHeader });
  const readyGoal = readyGoals.data.find(g => g._id === goalId);
  console.log(`Ready for concurrency test: Goal pot set to exactly ₹${readyGoal.currentAmount}`);

  // Fire 5 concurrent withdrawal requests of ₹1,000 each in parallel!
  console.log('Sending 5 simultaneous withdrawal requests of ₹1,000 each...');
  const promises = [1, 2, 3, 4, 5].map(i =>
    req(`/api/goals/${goalId}/emergency-withdraw`, {
      method: 'POST',
      headers: authHeader,
      body: { amount: 1000 }
    }).then(res => ({ id: i, ok: res.ok, status: res.status, data: res.data }))
  );

  const results = await Promise.all(promises);
  const successes = results.filter(r => r.ok);
  const failures = results.filter(r => !r.ok);

  console.log(`Concurrency Results: ${successes.length} succeeded, ${failures.length} rejected.`);

  const finalGoals = await req('/api/goals', { headers: authHeader });
  const finalGoal = finalGoals.data.find(g => g._id === goalId);
  console.log(`Final goal pot balance: ₹${finalGoal.currentAmount}`);

  if (successes.length === 3 && failures.length === 2 && finalGoal.currentAmount === 0) {
    console.log('✅ Concurrency & Atomicity test PASSED perfectly! Balance never went negative.');
  } else {
    console.error(`❌ Concurrency check unexpected state: ${successes.length} successes, balance: ${finalGoal.currentAmount}`);
    process.exit(1);
  }

  // 7. Verify Client Routing & Navigation
  console.log('\nStep 7: Verifying Client Routing & Sidebar Navigation...');
  const appJsx = fs.readFileSync(path.join(__dirname, '../../client/src/App.jsx'), 'utf8');
  const sidebarJsx = fs.readFileSync(path.join(__dirname, '../../client/src/components/Sidebar.jsx'), 'utf8');

  if (appJsx.includes('path="/transactions"') && appJsx.includes('Navigate to="/dashboard" replace')) {
    console.log('✅ App.jsx: /transactions route properly redirects to /dashboard.');
  } else {
    console.error('❌ App.jsx does not have redirect for /transactions');
    process.exit(1);
  }

  if (!sidebarJsx.includes("'Daily Expenses'") && !sidebarJsx.includes('path: \'/transactions\'')) {
    console.log('✅ Sidebar.jsx: Daily Expenses removed from user navigation.');
  } else {
    console.error('❌ Sidebar.jsx still contains Daily Expenses navigation item');
    process.exit(1);
  }

  // 8. Verify Zero Native Dialogs (alert, confirm, prompt)
  console.log('\nStep 8: Verifying Zero Native Browser Dialogs in Client Code...');
  const clientDir = path.join(__dirname, '../../client/src');
  
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        scanDir(full);
      } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
        const content = fs.readFileSync(full, 'utf8');
        const alertMatches = content.match(/(?<!\/\/.*)(?<!\/\*.*)\b(window\.)?alert\s*\(/g);
        const confirmMatches = content.match(/(?<!\/\/.*)(?<!\/\*.*)\b(window\.)?confirm\s*\(/g);
        const promptMatches = content.match(/(?<!\/\/.*)(?<!\/\*.*)\b(window\.)?prompt\s*\(/g);

        if (alertMatches || confirmMatches || promptMatches) {
          console.error(`❌ Found native dialog in ${f}: alert=${!!alertMatches}, confirm=${!!confirmMatches}, prompt=${!!promptMatches}`);
          process.exit(1);
        }
      }
    }
  }

  scanDir(clientDir);
  console.log('✅ Zero alert(), confirm(), or prompt() calls found across all client files.');

  console.log('\n======================================================');
  console.log('🎉 ALL FUNCTIONAL & CODE AUDIT TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================');
}

runTests();
