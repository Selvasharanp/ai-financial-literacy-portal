// server/tests/screenshotLocationAdvisor.js
// Automated verification and screenshot capture for Location-Based Budget Advisor in Dashboard

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
  await mongoose.connect(process.env.MONGO_URI);
  let user = await User.findOne();
  if (!user) {
    console.error('No user found');
    process.exit(1);
  }
  const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const userData = JSON.stringify({
    _id: user._id,
    name: user.name,
    email: user.email,
    userType: user.userType || 'Student',
    hasCompletedOnboarding: true
  });
  await mongoose.disconnect();

  console.log('User:', user.name, 'Token generated.');

  // Launch Edge with remote debugging
  const port = 9335;
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

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('token', '${token}');
      localStorage.setItem('user', JSON.stringify(${userData}));
    `
  });

  // Navigate to Dashboard
  console.log('Navigating to /dashboard...');
  await send('Page.navigate', { url: 'http://localhost:5173/dashboard' });
  await new Promise(r => setTimeout(r, 3000));

  // Scroll to Location Advisor
  console.log('Scrolling to Location Advisor section...');
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 360);' });
  await new Promise(r => setTimeout(r, 1000));

  // Capture initial advisor view
  const shotInitial = await send('Page.captureScreenshot', { format: 'png' });
  const outInitial = path.join(ARTIFACT_DIR, 'dashboard_location_advisor_initial.png');
  fs.writeFileSync(outInitial, Buffer.from(shotInitial.data, 'base64'));
  console.log('Saved initial advisor view:', outInitial);

  // Test Manual Entry: Enter "Bengaluru", Amount: ₹2,000, 5 Days
  console.log('Entering location: Bengaluru, ₹2,000, 5 days...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Click "Enter Location" button if present
        const enterBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter Location'));
        if (enterBtn) enterBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Find manual input and type Bengaluru
        const input = document.querySelector('input[placeholder*="Tenkasi"]');
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, 'Bengaluru');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Click Confirm Location
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirm Location'));
        if (confirmBtn) confirmBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Click Get Location Budget Advice
  console.log('Clicking Get Location Budget Advice for Bengaluru...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const getAdviceBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Get Location Budget Advice'));
        if (getAdviceBtn) getAdviceBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  // Capture Bengaluru results (Insufficient for ₹2,000)
  const shotBengaluru = await send('Page.captureScreenshot', { format: 'png' });
  const outBengaluru = path.join(ARTIFACT_DIR, 'dashboard_location_advisor_bengaluru.png');
  fs.writeFileSync(outBengaluru, Buffer.from(shotBengaluru.data, 'base64'));
  console.log('Saved Bengaluru results:', outBengaluru);

  // Now test Tenkasi: Click edit icon or enter location
  console.log('Entering location: Tenkasi, ₹2,000, 5 days...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const editBtn = document.querySelector('button[title="Change location"]');
        if (editBtn) editBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.querySelector('input[placeholder*="Tenkasi"]');
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, 'Tenkasi');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirm Location'));
        if (confirmBtn) confirmBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Click Get Location Budget Advice for Tenkasi
  console.log('Clicking Get Location Budget Advice for Tenkasi...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const getAdviceBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Get Location Budget Advice'));
        if (getAdviceBtn) getAdviceBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  // Capture Tenkasi results (Sufficient for ₹2,000)
  const shotTenkasi = await send('Page.captureScreenshot', { format: 'png' });
  const outTenkasi = path.join(ARTIFACT_DIR, 'dashboard_location_advisor_tenkasi.png');
  fs.writeFileSync(outTenkasi, Buffer.from(shotTenkasi.data, 'base64'));
  console.log('Saved Tenkasi results:', outTenkasi);

  // Inspect DOM values to ensure results rendered correctly
  const domValues = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const sufficiencyBanner = document.querySelector('.bento-card [style*="border-radius: 12px"][style*="padding: 16px"]');
        const dailyLimitBox = document.querySelector('.bento-card [style*="background: var(--primary)"]');
        return {
          bannerText: sufficiencyBanner ? sufficiencyBanner.innerText.substring(0, 150) : null,
          dailyLimitText: dailyLimitBox ? dailyLimitBox.innerText.replace(/\\n/g, ' ') : null
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Rendered DOM summary:', domValues.result.value);

  ws.close();
  edge.kill();
  console.log('All screenshot captures completed successfully!');
}

main().catch(err => {
  console.error('Error during screenshot execution:', err);
  process.exit(1);
});
