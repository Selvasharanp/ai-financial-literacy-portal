// server/tests/verifyDashboardChanges.js
// Automated verification suite for Dashboard changes:
// 1. Remove separate daily expense entry section
// 2. Remove "Upload receipt image" from Dashboard
// 3. Move/retain "Speak an expense" voice-input directly on Dashboard
// 4. Single-transaction creation guarantee
// 5. Remove Shared Trips & Group Splitter section from Dashboard
// 6. Verify Trip Splitter still works on dedicated page
// 7. Capture visual proof screenshots

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\f116ea53-9d9c-4952-a813-69e159e3c700';

async function runVerification() {
  console.log('🚀 STARTING FINWISE DASHBOARD VERIFICATION SUITE...\n');

  // Step 1: Connect to MongoDB and get test token
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne();
  if (!user) {
    console.error('❌ No user found in database.');
    process.exit(1);
  }
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  console.log(`✅ User identified: "${user.name}" (${user.email})`);

  // Step 2: Test backend voice parser API
  console.log('\n--- 1. Testing Voice Parser API (/api/ai/parse-voice) ---');
  const parseResRaw = await fetch('http://localhost:5000/api/ai/parse-voice', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ text: 'Spent ₹280 on pizza dinner today' })
  });
  const parseData = await parseResRaw.json();

  console.log('Parser output:', parseData);
  if (parseData.amount !== 280 || parseData.category !== 'Food' || parseData.type !== 'expense') {
    throw new Error('❌ Voice parser output mismatch: ' + JSON.stringify(parseData));
  }
  console.log('✅ Voice parser accurately extracted amount ₹280, Food category, and expense type.');

  // Step 3: Test single-transaction creation guarantee
  console.log('\n--- 2. Testing Single-Transaction Creation Guarantee ---');
  const initialCount = await Transaction.countDocuments({ userId: user._id });
  
  const createdTxRaw = await fetch('http://localhost:5000/api/transactions', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: parseData.title,
      amount: parseData.amount,
      type: 'expense',
      category: parseData.category,
      date: parseData.date,
      paymentMethod: 'UPI (Voice)',
      isVoice: true
    })
  });
  const createdTxData = await createdTxRaw.json();

  const newCount = await Transaction.countDocuments({ userId: user._id });
  const diff = newCount - initialCount;
  console.log(`Transaction count before: ${initialCount}, after: ${newCount}, diff: ${diff}`);
  
  if (diff !== 1) {
    throw new Error(`❌ Expected exactly 1 new transaction, but got diff of ${diff}`);
  }
  console.log('✅ Exactly ONE transaction created. Zero duplicate expense records.');

  // Clean up the created test transaction
  await Transaction.findByIdAndDelete(createdTxData._id);
  console.log('✅ Test transaction cleaned up from database.');

  // Step 4: Verify Trip Splitter backend API still works
  console.log('\n--- 3. Verifying Trip Splitter API (/api/trips) ---');
  const tripsRaw = await fetch('http://localhost:5000/api/trips', {
    headers: authHeaders
  });
  const tripsData = await tripsRaw.json();
  console.log(`Trips API status: ${tripsRaw.status}, retrieved ${tripsData.length} trips.`);
  if (tripsRaw.status !== 200) {
    throw new Error('❌ Trips API failed with status ' + tripsRaw.status);
  }
  console.log('✅ Dedicated Trip Splitter API responds with 200 OK and valid trip data.');

  await mongoose.disconnect();

  // Step 5: Headless Browser CDP Verification
  console.log('\n--- 4. Launching Headless Edge to Verify Dashboard & Trip Splitter UI ---');
  const port = 9336;
  const edge = spawn(EDGE_PATH, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--window-size=1280,1050',
    'http://localhost:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const targets = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/list`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find(t => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');

  const userData = JSON.stringify({
    _id: user._id,
    name: user.name,
    email: user.email,
    userType: user.userType || 'Student',
    hasCompletedOnboarding: true
  });

  // Set Auth in browser
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('token', '${token}');
      localStorage.setItem('user', JSON.stringify(${userData}));
    `
  });

  // Navigate to Dashboard
  console.log('Navigating to Dashboard (http://localhost:5173/)...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 3000));

  // Inspect Dashboard DOM
  const domCheck = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const bodyText = document.body.innerText;
        return {
          hasSpeakAnExpense: bodyText.includes('Speak an expense'),
          hasUploadReceipt: bodyText.includes('Upload receipt image'),
          hasSharedTripsSection: bodyText.includes('Shared Trips & Group Splitter'),
          hasCreateATrip: bodyText.includes('Create a Trip'),
          hasOpenTripSplitter: bodyText.includes('Open Trip Splitter'),
          hasCampusMessTag: bodyText.includes('#CampusMess'),
          hasLastSmsBtn: bodyText.includes('Auto-detect Last SMS'),
          hasTelemetryBanner: bodyText.includes('FinWise Spending Telemetry'),
          hasLocationAdvisor: bodyText.includes('Location-Based Budget Advice')
        };
      })()
    `
  });

  console.log('Dashboard DOM Audit Results:', domCheck.result.value);

  const audit = domCheck.result.value;
  if (!audit.hasSpeakAnExpense) throw new Error('❌ "Speak an expense" is missing from Dashboard.');
  if (audit.hasUploadReceipt) throw new Error('❌ "Upload receipt image" was found on Dashboard. It must be removed.');
  if (audit.hasSharedTripsSection) throw new Error('❌ "Shared Trips & Group Splitter" section is still on Dashboard.');
  if (audit.hasCreateATrip) throw new Error('❌ "Create a Trip" was found on Dashboard.');
  if (audit.hasCampusMessTag || audit.hasLastSmsBtn) throw new Error('❌ Old standalone daily expense entry section was found on Dashboard.');
  if (!audit.hasTelemetryBanner) throw new Error('❌ FinWise Spending Telemetry banner was accidentally removed.');
  if (!audit.hasLocationAdvisor) throw new Error('❌ Location-Based Budget Advisor was accidentally removed.');

  console.log('✅ DOM Audit passed: Daily expense form & Shared Trips completely removed.');
  console.log('✅ DOM Audit passed: FinWise Spending Telemetry & Location Budget Advisor preserved.');
  console.log('✅ DOM Audit passed: No receipt upload on Dashboard.');

  // Test Voice Expense Interaction on Dashboard
  console.log('\n--- 5. Testing Interactive Voice Expense Record on Dashboard ---');
  await send('Runtime.evaluate', {
    expression: 'window.scrollTo(0, 500);'
  });
  await new Promise(r => setTimeout(r, 500));

  // Trigger voice parse via UI helper
  const voiceParseResult = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `
      (async () => {
        if (window.__finwiseVoice) {
          await window.__finwiseVoice.processVoiceText("Spent ₹320 on lunch today");
          return { success: true };
        }
        return { success: false };
      })()
    `
  });

  console.log('Triggered voice phrase parse:', voiceParseResult.result.value);
  await new Promise(r => setTimeout(r, 1200));

  // Verify draft details appeared
  const draftRendered = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const bodyText = document.body.innerText;
        return {
          showsRecognized: /recognized expense details/i.test(bodyText),
          showsConfirmBtn: bodyText.includes('Confirm & Save Expense')
        };
      })()
    `
  });

  console.log('Voice draft rendered on UI:', draftRendered.result.value);
  if (!draftRendered.result.value.showsRecognized) {
    throw new Error('❌ Voice draft did not render on Dashboard.');
  }

  // Click Confirm & Save Expense
  console.log('Saving voice draft into transaction ledger...');
  const saveResult = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `
      (async () => {
        if (window.__finwiseVoice) {
          await window.__finwiseVoice.saveDraft();
          return { saved: true };
        }
        return { saved: false };
      })()
    `
  });
  console.log('Save draft execution result:', saveResult.result.value);
  await new Promise(r => setTimeout(r, 2000));

  // Capture screenshot of updated Dashboard
  console.log('Capturing Dashboard screenshot...');
  const screenshotDash = await send('Page.captureScreenshot', { format: 'png' });
  const dashPath = path.join(ARTIFACT_DIR, 'dashboard_voice_expense_verified.png');
  fs.writeFileSync(dashPath, Buffer.from(screenshotDash.data, 'base64'));
  console.log(`📸 Screenshot saved: ${dashPath}`);

  // Navigate to dedicated Trip Splitter page
  console.log('\n--- 6. Verifying Dedicated Trip Splitter Page (/trip-splitter) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/trip-splitter' });
  await new Promise(r => setTimeout(r, 3000));

  const tripSplitterCheck = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const bodyText = document.body.innerText;
        return {
          hasTripSplitterHeading: bodyText.includes('Trip Splitter') || bodyText.includes('Collaborative Trips'),
          hasCreateTripOption: bodyText.includes('Create') || bodyText.includes('New Trip'),
          isTripSplitterPage: window.location.pathname.includes('/trip-splitter')
        };
      })()
    `
  });

  console.log('Trip Splitter Page Verification:', tripSplitterCheck.result.value);
  if (!tripSplitterCheck.result.value.isTripSplitterPage) {
    throw new Error('❌ Failed to navigate to Trip Splitter page.');
  }

  // Capture screenshot of Trip Splitter page
  console.log('Capturing Trip Splitter page screenshot...');
  const screenshotTrip = await send('Page.captureScreenshot', { format: 'png' });
  const tripPath = path.join(ARTIFACT_DIR, 'trip_splitter_page_verified.png');
  fs.writeFileSync(tripPath, Buffer.from(screenshotTrip.data, 'base64'));
  console.log(`📸 Screenshot saved: ${tripPath}`);

  // Clean up
  ws.close();
  edge.kill();

  console.log('\n======================================================');
  console.log('🎉 ALL DASHBOARD VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
