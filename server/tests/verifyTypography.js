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

async function runTypographyVerification() {
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
  const profileDir = path.join(__dirname, '../.edge-profile-typo-' + port);
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

  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();
  function send(m, p = {}) {
    return new Promise((resolve, reject) => {
      const cur = id++;
      const timer = setTimeout(() => {
        if (pending.has(cur)) {
          pending.delete(cur);
          resolve({ error: { message: `Timeout on ${m}` } });
        }
      }, 8000);
      pending.set(cur, {
        resolve: res => { clearTimeout(timer); resolve(res); },
        reject: err => { clearTimeout(timer); reject(err); }
      });
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

  const routes = [
    { name: 'Login', url: 'http://localhost:5173/login', auth: false, screenshot: 'login_typography_verified.png' },
    { name: 'Register', url: 'http://localhost:5173/register', auth: false, screenshot: 'register_typography_verified.png' },
    { name: 'Trip Splitter', url: 'http://localhost:5173/trip-splitter', auth: true, screenshot: 'trip_splitter_typography_verified.png' },
    { name: 'Dashboard', url: 'http://localhost:5173/dashboard', auth: true, screenshot: 'dashboard_typography_verified.png' },
    { name: 'Transactions', url: 'http://localhost:5173/transactions', auth: true, screenshot: 'transactions_typography_verified.png' },
    { name: 'Goals Tracker', url: 'http://localhost:5173/goals', auth: true, screenshot: 'goals_typography_verified.png' },
    { name: 'Travel Planner', url: 'http://localhost:5173/travel-planner', auth: true, screenshot: 'travel_planner_typography_verified.png' },
    { name: 'Literacy Hub', url: 'http://localhost:5173/literacy', auth: true, screenshot: 'literacy_hub_typography_verified.png' },
    { name: 'Profile & Settings', url: 'http://localhost:5173/profile', auth: true, screenshot: 'profile_typography_verified.png' }
  ];

  const results = [];
  let authSet = false;

  for (const r of routes) {
    console.log(`Checking route typography: ${r.name}...`);
    if (r.auth && !authSet) {
      await send('Runtime.evaluate', {
        expression: `
          localStorage.setItem('token', ${JSON.stringify(token)});
          localStorage.setItem('user', ${JSON.stringify(userData)});
        `
      });
      authSet = true;
    }

    await send('Page.navigate', { url: r.url });
    await new Promise(res => setTimeout(res, 1800));

    const checkRes = await send('Runtime.evaluate', {
      returnByValue: true,
      awaitPromise: true,
      expression: `
        (async () => {
          try { await document.fonts.ready; } catch(e) {}

          const getStyle = el => {
            if (!el) return null;
            const s = window.getComputedStyle(el);
            return {
              fontFamily: s.fontFamily,
              fontWeight: s.fontWeight,
              fontSize: s.fontSize
            };
          };

          const allFonts = new Set();
          document.querySelectorAll('*').forEach(el => {
            const ff = window.getComputedStyle(el).fontFamily;
            if (ff) allFonts.add(ff);
          });

          return {
            fontLoaded: document.fonts.check("16px 'DM Serif Display'"),
            body: getStyle(document.body),
            h1: getStyle(document.querySelector('h1')),
            h2: getStyle(document.querySelector('h2')),
            h3: getStyle(document.querySelector('h3')),
            p: getStyle(document.querySelector('p')),
            button: getStyle(document.querySelector('button')),
            input: getStyle(document.querySelector('input')),
            label: getStyle(document.querySelector('label')),
            allFonts: Array.from(allFonts)
          };
        })()
      `
    });

    // Capture screenshot
    if (r.screenshot) {
      try {
        const scr = await send('Page.captureScreenshot', { format: 'png' });
        if (scr && scr.data) {
          fs.writeFileSync(path.join(ARTIFACTS_DIR, r.screenshot), Buffer.from(scr.data, 'base64'));
          console.log(`   📸 Saved ${r.screenshot}`);
        } else {
          console.log(`   ⚠️ Screenshot response did not contain data:`, scr);
        }
      } catch (err) {
        console.log(`   ⚠️ Screenshot error:`, err.message);
      }
    }

    const computed = checkRes?.result?.value || checkRes;
    results.push({
      route: r.name,
      url: r.url,
      computed
    });
    console.log(`   ✅ Route ${r.name} verified.`);
  }

  console.log('=== GLOBAL TYPOGRAPHY VERIFICATION REPORT ===');
  console.log(JSON.stringify(results, null, 2));

  ws.close();
  edge.kill();
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
}

runTypographyVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
