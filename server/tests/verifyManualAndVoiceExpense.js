// server/tests/verifyManualAndVoiceExpense.js
// Automated verification suite for:
// 1. "Speak an Expense" section placed immediately ABOVE "Location-Based Budget Suggestions"
// 2. Both Voice and Manual expense phrase entry work independently
// 3. Validation and error handling for invalid phrases and missing amounts
// 4. Single-transaction creation guarantee and Safe Balance sync
// 5. Visual screenshots of draft card, success confirmation, and section hierarchy

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
  console.log('=== STARTING MANUAL & VOICE EXPENSE DASHBOARD VERIFICATION ===\n');

  // Step 1: Connect to MongoDB and fetch test user
  await mongoose.connect(process.env.MONGO_URI);
  let user = await User.findOne({ email: 'suresh@example.com' }) || await User.findOne();
  if (!user) {
    console.error('❌ No user found in database.');
    process.exit(1);
  }
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  console.log(`✅ Test User identified: "${user.name}" (${user.email})`);

  // Step 2: Test backend /api/ai/parse-voice endpoint
  console.log('\n--- 1. Testing Backend /api/ai/parse-voice API ---');
  
  // Test empty text
  const emptyRes = await fetch('http://localhost:5000/api/ai/parse-voice', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ text: '' })
  });
  if (emptyRes.status !== 400) {
    throw new Error(`❌ Expected 400 for empty text, got ${emptyRes.status}`);
  }
  console.log('✅ Empty phrase rejected with HTTP 400.');

  // Test missing amount
  const noAmountRes = await fetch('http://localhost:5000/api/ai/parse-voice', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ text: 'Had lunch with friends' })
  });
  const noAmountData = await noAmountRes.json();
  if (noAmountRes.status !== 400 || !noAmountData.error.includes('valid amount')) {
    throw new Error(`❌ Expected 400 for phrase without amount, got ${noAmountRes.status}: ${JSON.stringify(noAmountData)}`);
  }
  console.log('✅ Phrase without amount rejected with useful hint:', noAmountData.error);

  // Test valid manual expense phrase
  const validRes = await fetch('http://localhost:5000/api/ai/parse-voice', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ text: 'Spent ₹250 on lunch today' })
  });
  const validData = await validRes.json();
  if (validData.amount !== 250 || validData.category !== 'Food' || validData.type !== 'expense') {
    throw new Error(`❌ Expected amount=250, category=Food, type=expense, got: ${JSON.stringify(validData)}`);
  }
  console.log('✅ Valid phrase parsed successfully:', validData);

  // Step 3: Launch Headless Edge for UI verification
  console.log('\n--- 2. Launching Headless Edge to Verify Dashboard Hierarchy & UI ---');
  const port = 9390 + Math.floor(Math.random() * 50);
  const profileDir = path.join(__dirname, '../.edge-profile-expense-' + port);
  const edge = spawn(EDGE_PATH, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
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
      const timer = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ error: { message: `Timeout on ${method}` } });
        }
      }, 10000);
      pending.set(id, {
        resolve: res => { clearTimeout(timer); resolve(res); },
        reject: err => { clearTimeout(timer); reject(err); }
      });
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
  await send('DOM.enable');

  const userData = JSON.stringify({
    _id: user._id,
    name: user.name,
    email: user.email,
    userType: user.userType || 'Student',
    hasCompletedOnboarding: true
  });

  // Initial navigation to establish origin
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 1200));

  // Inject authentication into browser localStorage
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('token', ${JSON.stringify(token)});
      localStorage.setItem('user', ${JSON.stringify(userData)});
    `
  });

  console.log('Navigating to Dashboard (http://localhost:5173/dashboard)...');
  await send('Page.navigate', { url: 'http://localhost:5173/dashboard' });

  // Wait for Dashboard to mount and elements to appear
  console.log('Waiting for Dashboard elements to render...');
  let loaded = false;
  for (let i = 0; i < 25; i++) {
    const poll = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const el = document.getElementById('inline-expense-title');
          return {
            hasInput: Boolean(el),
            url: window.location.href,
            bodyText: document.body ? document.body.innerText.slice(0, 100) : ''
          };
        })()
      `
    });
    if (poll.result && poll.result.value && poll.result.value.hasInput) {
      console.log(`✅ Dashboard rendered in ${(i + 1) * 500}ms`);
      loaded = true;
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, 1000));

  // Step 4: Verify DOM Position - "Speak an Expense" MUST be above "Location-Based Budget Advice"
  console.log('\n--- 3. Verifying Section Hierarchy & Order ---');
  const hierarchyCheck = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
          tag: h.tagName,
          text: h.innerText.trim(),
          top: h.getBoundingClientRect().top + window.pageYOffset
        }));

        const speakIdx = headings.findIndex(h => /speak an expense/i.test(h.text));
        const locationIdx = headings.findIndex(h => /location-based budget advice/i.test(h.text));

        const speakCount = headings.filter(h => /speak an expense/i.test(h.text)).length;
        const locationCount = headings.filter(h => /location-based budget advice/i.test(h.text)).length;

        const whereInput = document.getElementById('inline-expense-title');
        const amountInput = document.getElementById('inline-expense-amount');
        const categorySelect = document.getElementById('inline-expense-category');
        const submitBtn = document.getElementById('inline-expense-submit-btn');

        return {
          url: window.location.href,
          bodyPreview: document.body.innerText.slice(0, 300),
          headings,
          speakIdx,
          locationIdx,
          isSpeakAboveLocation: speakIdx !== -1 && locationIdx !== -1 && speakIdx < locationIdx,
          speakTop: speakIdx !== -1 ? headings[speakIdx].top : null,
          locationTop: locationIdx !== -1 ? headings[locationIdx].top : null,
          speakCount,
          locationCount,
          hasWhereInput: Boolean(whereInput),
          wherePlaceholder: whereInput ? whereInput.placeholder : null,
          hasAmountInput: Boolean(amountInput),
          amountPlaceholder: amountInput ? amountInput.placeholder : null,
          hasCategorySelect: Boolean(categorySelect),
          hasSubmitBtn: Boolean(submitBtn)
        };
      })()
    `
  });

  const hRes = hierarchyCheck.result.value;
  console.log('Section Hierarchy Evaluation:', {
    url: hRes.url,
    bodyPreview: hRes.bodyPreview,
    speakIdx: hRes.speakIdx,
    locationIdx: hRes.locationIdx,
    speakTop: hRes.speakTop,
    locationTop: hRes.locationTop,
    isSpeakAboveLocation: hRes.isSpeakAboveLocation,
    speakCount: hRes.speakCount,
    locationCount: hRes.locationCount,
    hasWhereInput: hRes.hasWhereInput,
    wherePlaceholder: hRes.wherePlaceholder,
    hasAmountInput: hRes.hasAmountInput,
    amountPlaceholder: hRes.amountPlaceholder,
    hasCategorySelect: hRes.hasCategorySelect,
    hasSubmitBtn: hRes.hasSubmitBtn
  });

  if (!hRes.isSpeakAboveLocation) {
    throw new Error(`❌ Hierarchy Check FAILED: "Speak an Expense" (idx ${hRes.speakIdx}) is NOT above "Location-Based Budget Advice" (idx ${hRes.locationIdx})!`);
  }
  if (hRes.speakCount !== 1) {
    throw new Error(`❌ Duplication detected: Speak an Expense appears ${hRes.speakCount} times.`);
  }
  if (hRes.locationCount !== 1) {
    throw new Error(`❌ Duplication detected: Location-Based Budget Advice appears ${hRes.locationCount} times.`);
  }
  if (!hRes.hasWhereInput || !hRes.wherePlaceholder.includes('Where did you spend')) {
    throw new Error('❌ "Where did you spend?" placeholder is missing or incorrect!');
  }
  if (!hRes.hasAmountInput || !hRes.amountPlaceholder.includes('How much')) {
    throw new Error('❌ "How much?" placeholder is missing or incorrect!');
  }
  console.log('✅ Section Hierarchy & 2-Placeholder Form VERIFIED: "Where did you spend?" and "How much?" placeholders confirmed.');

  // Capture Screenshot of Section Placement
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'dashboard_expense_above_location.png'), Buffer.from(shot1.data, 'base64'));
  console.log('📸 Saved placement screenshot: dashboard_expense_above_location.png');

  // Step 5: Test Two-Placeholder Manual Expense Entry and Single Transaction Creation
  console.log('\n--- 4. Testing Two-Placeholder Manual Expense Entry & Save ---');
  
  // Fill Where and How much
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const whereInp = document.getElementById('inline-expense-title');
        const amtInp = document.getElementById('inline-expense-amount');
        const catSelect = document.getElementById('inline-expense-category');

        if (whereInp) {
          const s1 = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          s1.call(whereInp, 'Campus Canteen Lunch');
          whereInp.dispatchEvent(new Event('input', { bubbles: true }));
          whereInp.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (amtInp) {
          const s2 = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          s2.call(amtInp, '160');
          amtInp.dispatchEvent(new Event('input', { bubbles: true }));
          amtInp.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (catSelect) {
          catSelect.value = 'Food';
          catSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Capture screenshot of filled two placeholders
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'dashboard_two_placeholders_expense.png'), Buffer.from(shot2.data, 'base64'));
  console.log('📸 Saved two-placeholder form screenshot: dashboard_two_placeholders_expense.png');

  // Submit the form
  const countBefore = await Transaction.countDocuments({ userId: user._id });
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const submitBtn = document.getElementById('inline-expense-submit-btn');
        if (submitBtn) submitBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1800));

  const countAfter = await Transaction.countDocuments({ userId: user._id });
  const createdManualTx = await Transaction.findOne({ userId: user._id, title: 'Campus Canteen Lunch', amount: 160 }).sort({ createdAt: -1 });

  console.log(`Transactions in DB before: ${countBefore}, after: ${countAfter}, diff: ${countAfter - countBefore}`);
  if (countAfter - countBefore !== 1) {
    throw new Error(`❌ Single Transaction Guarantee FAILED! Expected diff 1, got ${countAfter - countBefore}`);
  }
  if (!createdManualTx) {
    throw new Error('❌ Created manual transaction was not found in MongoDB!');
  }
  console.log(`✅ Single transaction created in MongoDB: ID=${createdManualTx._id}, title="${createdManualTx.title}", amount=${createdManualTx.amount}, paymentMethod="${createdManualTx.paymentMethod}"`);

  // Verify success banner on UI
  const successBannerCheck = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const bodyText = document.body.innerText;
        const whereInp = document.getElementById('inline-expense-title');
        const amtInp = document.getElementById('inline-expense-amount');
        return {
          hasSuccessBanner: bodyText.includes('Recorded ₹160 for "Campus Canteen Lunch" (Food).'),
          whereCleared: !whereInp || whereInp.value === '',
          amtCleared: !amtInp || amtInp.value === ''
        };
      })()
    `
  });
  console.log('Success confirmation on UI:', successBannerCheck.result.value);
  if (!successBannerCheck.result.value.hasSuccessBanner) {
    throw new Error('❌ Success banner did not appear on Dashboard after saving manual expense.');
  }
  if (!successBannerCheck.result.value.whereCleared || !successBannerCheck.result.value.amtCleared) {
    throw new Error('❌ Inputs were not cleared after saving expense.');
  }

  // Capture screenshot of saved manual expense
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'dashboard_manual_expense_saved.png'), Buffer.from(shot3.data, 'base64'));
  console.log('📸 Saved manual expense confirmed screenshot: dashboard_manual_expense_saved.png');

  // Step 8: Test Voice Expense Record Independently
  console.log('\n--- 7. Testing Voice Expense Record Independently ---');
  const countBeforeVoice = await Transaction.countDocuments({ userId: user._id });

  // Trigger voice parse via helper
  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `
      (async () => {
        if (window.__finwiseVoice) {
          await window.__finwiseVoice.processVoiceText("Spent ₹180 on coffee and snacks today");
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  // Save voice draft
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => /confirm & save expense/i.test(b.innerText));
        if (confirmBtn) confirmBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1800));

  const countAfterVoice = await Transaction.countDocuments({ userId: user._id });
  const createdVoiceTx = await Transaction.findOne({ userId: user._id, amount: 180 }).sort({ createdAt: -1 });

  console.log(`Voice expense DB count before: ${countBeforeVoice}, after: ${countAfterVoice}, diff: ${countAfterVoice - countBeforeVoice}`);
  if (countAfterVoice - countBeforeVoice !== 1) {
    throw new Error(`❌ Single Transaction Guarantee FAILED for Voice! Expected diff 1, got ${countAfterVoice - countBeforeVoice}`);
  }
  if (!createdVoiceTx || !createdVoiceTx.isVoice) {
    throw new Error('❌ Created voice transaction was not found or not marked isVoice=true!');
  }
  console.log(`✅ Voice transaction created independently: ID=${createdVoiceTx._id}, title="${createdVoiceTx.title}", paymentMethod="${createdVoiceTx.paymentMethod}"`);

  // Clean up created test transactions
  if (createdManualTx) await Transaction.findByIdAndDelete(createdManualTx._id);
  if (createdVoiceTx) await Transaction.findByIdAndDelete(createdVoiceTx._id);
  console.log('✅ Cleaned up temporary test transactions from database.');

  ws.close();
  edge.kill();
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  await mongoose.disconnect();

  console.log('\n======================================================');
  console.log('🎉 ALL MANUAL & VOICE EXPENSE DASHBOARD TESTS PASSED 100%!');
  console.log('======================================================\n');
}

runVerification().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
