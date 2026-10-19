const http = require('http');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\f116ea53-9d9c-4952-a813-69e159e3c700';

async function auditTravelPlanner() {
  console.log('--- AUDITING TRAVEL BUDGET PLANNER MOBILE RESPONSIVENESS ---');

  await mongoose.connect(process.env.MONGO_URI);
  let user = await User.findOne({ email: 'suresh@example.com' }) || await User.findOne();
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  const userData = JSON.stringify({
    _id: user._id,
    name: user.name,
    email: user.email,
    userType: user.userType || 'Student',
    hasCompletedOnboarding: true
  });
  await mongoose.disconnect();

  const port = 9390 + Math.floor(Math.random() * 50);
  const profileDir = path.join(__dirname, '../.edge-profile-' + port);
  const edge = spawn(EDGE_PATH, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,900',
    'http://localhost:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const list = await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${port}/json/list`, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });

  const pageTarget = list.find(t => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();
  function send(m, p = {}) {
    return new Promise((resolve, reject) => {
      const cur = id++;
      pending.set(cur, { resolve, reject });
      ws.send(JSON.stringify({ id: cur, method: m, params: p }));
    });
  }

  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
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

  await send('Page.navigate', { url: 'http://localhost:5173/travel-planner' });
  await new Promise(r => setTimeout(r, 1200));

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('token', ${JSON.stringify(token)});
      localStorage.setItem('user', ${JSON.stringify(userData)});
    `
  });

  await send('Page.navigate', { url: 'http://localhost:5173/travel-planner' });
  await new Promise(r => setTimeout(r, 1200));

  // Trigger Plan Generation with a realistic trip to test itinerary cards
  console.log('Generating sample trip (Bengaluru -> Kodaikanal)...');
  await send('Runtime.evaluate', {
    expression: `
      (function() {
        const destInput = document.getElementById('travel-dest-input');
        if (destInput) {
          const tracker = destInput._valueTracker;
          if (tracker) tracker.setValue('');
          destInput.value = 'Kodaikanal';
          destInput.dispatchEvent(new Event('input', { bubbles: true }));
          destInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const submitBtn = document.querySelector('form button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `
  });

  // Wait up to 20 seconds for planResult to render
  console.log('Waiting for plan result itinerary to render...');
  for (let i = 0; i < 40; i++) {
    const hasCard = await send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('.travel-day-card'))`,
      returnByValue: true
    });
    if (hasCard.result.value) {
      console.log('Plan result rendered successfully!');
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  const widths = [320, 360, 375, 390, 430, 768, 1024, 1440];

  for (const w of widths) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: 850,
      deviceScaleFactor: 1,
      mobile: w < 768
    });

    await new Promise(r => setTimeout(r, 400));

    // Scroll to timeline
    await send('Runtime.evaluate', {
      expression: `
        const el = document.querySelector('.travel-day-card');
        if (el) {
          const top = el.getBoundingClientRect().top + window.pageYOffset - 75;
          window.scrollTo(0, Math.max(0, top));
        }
      `
    });
    await new Promise(r => setTimeout(r, 400));

    const check = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
          const winW = window.innerWidth;
          const overflow = docW > winW + 2;

          // Check if any element overflows the body width
          const elements = Array.from(document.querySelectorAll('*'));
          const overflowEls = [];
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            if (rect.right > winW + 2) {
              overflowEls.push({
                tag: el.tagName,
                className: el.className,
                text: (el.innerText || '').slice(0, 30),
                rectRight: rect.right,
                winW: winW
              });
              if (overflowEls.length >= 5) break;
            }
          }

          return { docW, winW, overflow, overflowEls };
        })()
      `,
      returnByValue: true
    });

    const res = check.result.value;
    console.log(`Width ${w}px: docWidth=${res.docW}, overflow=${res.overflow}`);
    if (res.overflow) {
      console.log('   Overflowing elements:', JSON.stringify(res.overflowEls, null, 2));
    }

    if ([320, 375, 768].includes(w)) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACTS_DIR, `audit_travel_timeline_${w}px.png`), Buffer.from(shot.data, 'base64'));
      console.log(`   📸 Saved timeline audit screenshot: audit_travel_timeline_${w}px.png`);
    }
  }

  ws.close();
  edge.kill();
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  console.log('--- AUDIT FINISHED ---');
}

auditTravelPlanner().catch(console.error);
