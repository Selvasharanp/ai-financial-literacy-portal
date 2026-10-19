const http = require('http');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function check() {
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

  const port = 9350;
  const edge = spawn(EDGE_PATH, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
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
  await send('Runtime.enable');
  await send('Page.enable');

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('token', '${token}');
      localStorage.setItem('user', JSON.stringify(${userData}));
    `
  });

  await send('Page.navigate', { url: 'http://localhost:5173/trip-splitter' });
  await new Promise(r => setTimeout(r, 3000));

  const evalRes = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const getStyle = el => {
          if (!el) return null;
          const s = window.getComputedStyle(el);
          return {
            fontFamily: s.fontFamily,
            fontWeight: s.fontWeight,
            fontSize: s.fontSize,
            letterSpacing: s.letterSpacing
          };
        };

        const allFonts = new Set();
        document.querySelectorAll('*').forEach(el => {
          const ff = window.getComputedStyle(el).fontFamily;
          if (ff) allFonts.add(ff);
        });

        return {
          body: getStyle(document.body),
          h1: getStyle(document.querySelector('h1')),
          h2: getStyle(document.querySelector('h2')),
          h3: getStyle(document.querySelector('h3')),
          p: getStyle(document.querySelector('p')),
          button: getStyle(document.querySelector('button')),
          input: getStyle(document.querySelector('input')),
          card: getStyle(document.querySelector('.bento-card, .trip-card')),
          navbar: getStyle(document.querySelector('.top-navbar')),
          allFontFamiliesFoundInPage: Array.from(allFonts)
        };
      })()
    `
  });

  console.log('=== TRIP SPLITTER COMPUTED STYLES & FONTS ===');
  console.log(JSON.stringify(evalRes.result.value, null, 2));

  ws.close();
  edge.kill();
}

check().catch(console.error);
