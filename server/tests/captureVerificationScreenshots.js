const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\f116ea53-9d9c-4952-a813-69e159e3c700';

async function main() {
  console.log('📸 STARTING VERIFICATION SCREENSHOT CAPTURE...\n');

  await mongoose.connect(process.env.MONGO_URI);
  let user = await User.findOne({ email: 'suresh@example.com' }) || await User.findOne();
  if (!user) {
    console.error('❌ No user found.');
    process.exit(1);
  }
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  const userData = JSON.stringify({
    _id: user._id,
    name: user.name,
    email: user.email,
    userType: user.userType || 'Student',
    hasCompletedOnboarding: true
  });
  await mongoose.disconnect();

  const port = 9345;
  const edge = spawn(EDGE_PATH, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--window-size=1380,950',
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
  if (!pageTarget) {
    console.error('❌ Page target not found.');
    edge.kill();
    process.exit(1);
  }

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

  // Allocate funds to goal so card has active progress
  try {
    const goalsRes = await fetch('http://localhost:5000/api/goals', { headers: { Authorization: `Bearer ${token}` } });
    const goals = await goalsRes.json();
    if (Array.isArray(goals) && goals.length > 0) {
      await fetch(`http://localhost:5000/api/goals/${goals[0]._id}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 15000 })
      });
    }
  } catch (e) {}

  // Inject token in localStorage
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('token', '${token}');
      localStorage.setItem('user', JSON.stringify(${userData}));
    `
  });

  async function snap(url, filename, actionFn) {
    console.log(`Navigating to ${url}...`);
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 2500));

    if (actionFn) {
      await actionFn();
      await new Promise(r => setTimeout(r, 800));
    }

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log(`✅ Saved: ${filename}`);
  }

  // 1. Goals Page
  await snap('http://localhost:5173/goals', 'goals_page_verified.png');

  // 2. Profile Page (Read-Only)
  await snap('http://localhost:5173/profile', 'profile_page_verified.png');

  // 3. Profile Page (Edit Mode)
  await snap('http://localhost:5173/profile', 'profile_edit_mode_verified.png', async () => {
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Edit Profile'));
          if (btn) btn.click();
        })()
      `
    });
  });

  // 4. Dashboard Page
  await snap('http://localhost:5173/dashboard', 'dashboard_page_verified.png');

  // 5. Login Page
  await snap('http://localhost:5173/login', 'login_page_verified.png', async () => {
    await send('Runtime.evaluate', {
      expression: `localStorage.clear();`
    });
    await send('Page.navigate', { url: 'http://localhost:5173/login' });
  });

  console.log('\n🎉 ALL SCREENSHOTS SUCCESSFULLY CAPTURED!');

  ws.close();
  edge.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error during capture:', err);
  process.exit(1);
});
