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

async function runResponsiveVerification() {
  console.log('--- STARTING RESPONSIVE LAYOUT & FAVICON VERIFICATION (EDGE CDP) ---');

  // Verify Favicon HTTP
  console.log('\n[1/4] Verifying Favicon asset HTTP serving...');
  const faviconContent = await new Promise((resolve, reject) => {
    http.get('http://localhost:5173/favicon.svg', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });

  if (faviconContent.status === 200 && faviconContent.body.includes('<svg') && faviconContent.body.includes('#1B3F38') && faviconContent.body.includes('#E5C690')) {
    console.log('✅ Favicon is served properly as SVG with deep forest-green and gold wealth symbols.');
  } else {
    console.error('❌ Favicon check failed:', faviconContent.status);
    process.exit(1);
  }

  // Get Auth Token
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

  const port = 9365;
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

  // Inject session
  await send('Page.navigate', { url: 'http://localhost:5173/dashboard' });
  await new Promise(r => setTimeout(r, 1200));

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('token', ${JSON.stringify(token)});
      localStorage.setItem('user', ${JSON.stringify(userData)});
    `
  });

  const viewports = [
    { name: 'Mobile (375x667)', width: 375, height: 667, mobile: true },
    { name: 'Tablet (768x1024)', width: 768, height: 1024, mobile: false },
    { name: 'Desktop (1280x800)', width: 1280, height: 800, mobile: false }
  ];

  const routes = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Travel Planner', path: '/travel-planner' },
    { name: 'Goals Tracker', path: '/goals' },
    { name: 'Trip Splitter', path: '/trip-splitter' },
    { name: 'Literacy Hub', path: '/literacy' },
    { name: 'Profile Settings', path: '/profile' },
    { name: 'Login', path: '/login' },
    { name: 'Register', path: '/register' }
  ];

  console.log('\n[2/4] Testing Viewports & Horizontal Overflow across all routes...');
  let totalOverflows = 0;

  for (const vp of viewports) {
    console.log(`\n================ Viewport: ${vp.name} ================`);
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile
    });

    for (const route of routes) {
      await send('Page.navigate', { url: `http://localhost:5173${route.path}` });
      await new Promise(r => setTimeout(r, 800));

      const overflowEval = await send('Runtime.evaluate', {
        expression: `
          (function() {
            var root = document.documentElement;
            var body = document.body;
            var winW = window.innerWidth;
            var docW = Math.max(root.scrollWidth, body.scrollWidth);
            var overflow = docW > winW + 2;
            return { winW: winW, docW: docW, overflow: overflow };
          })()
        `,
        returnByValue: true
      });

      const res = overflowEval.result.value;
      if (res.overflow) {
        console.error(`❌ Overflow on ${route.name.padEnd(16)} (${vp.name}): docWidth=${res.docW} > winWidth=${res.winW}`);
        totalOverflows++;
      } else {
        console.log(`✅ ${route.name.padEnd(16)}: No horizontal overflow (docWidth=${res.docW} <= ${res.winW})`);
      }

      // Capture screenshots for artifacts
      if (vp.width === 375 && ['Dashboard', 'Trip Splitter', 'Login', 'Profile Settings'].includes(route.name)) {
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const filename = `mobile_${route.name.toLowerCase().replace(/\s+/g, '_')}_verified.png`;
        fs.writeFileSync(path.join(ARTIFACTS_DIR, filename), Buffer.from(shot.data, 'base64'));
        console.log(`   📸 Captured screenshot: ${filename}`);
      }
      if (vp.width === 768 && ['Dashboard', 'Goals Tracker'].includes(route.name)) {
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const filename = `tablet_${route.name.toLowerCase().replace(/\s+/g, '_')}_verified.png`;
        fs.writeFileSync(path.join(ARTIFACTS_DIR, filename), Buffer.from(shot.data, 'base64'));
        console.log(`   📸 Captured screenshot: ${filename}`);
      }
      if (vp.width === 1280 && ['Dashboard'].includes(route.name)) {
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const filename = `desktop_${route.name.toLowerCase().replace(/\s+/g, '_')}_verified.png`;
        fs.writeFileSync(path.join(ARTIFACTS_DIR, filename), Buffer.from(shot.data, 'base64'));
        console.log(`   📸 Captured screenshot: ${filename}`);
      }
    }
  }

  // Test Mobile Hamburger Navigation Toggle & Drawer
  console.log('\n[3/4] Testing Mobile Navigation Menu Drawer on Mobile Viewport...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 667,
    deviceScaleFactor: 1,
    mobile: true
  });
  await send('Page.navigate', { url: 'http://localhost:5173/dashboard' });
  await new Promise(r => setTimeout(r, 800));

  const mobileToggleCheck = await send('Runtime.evaluate', {
    expression: `
      (function() {
        var toggle = document.querySelector('.navbar-mobile-toggle');
        if (!toggle) return { exists: false };
        var s = window.getComputedStyle(toggle);
        return { exists: true, display: s.display, visible: s.display !== 'none' };
      })()
    `,
    returnByValue: true
  });

  if (mobileToggleCheck.result.value.visible) {
    console.log('✅ Mobile hamburger button is visible on mobile viewport (display: flex).');
  } else {
    console.error('❌ Mobile hamburger button is not visible:', mobileToggleCheck.result.value);
    process.exit(1);
  }

  // Click mobile hamburger button
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.navbar-mobile-toggle').click()`
  });
  await new Promise(r => setTimeout(r, 400));

  const drawerCheck = await send('Runtime.evaluate', {
    expression: `
      (function() {
        var drawer = document.querySelector('.navbar-mobile-drawer');
        var items = document.querySelectorAll('.navbar-mobile-item');
        var logout = document.querySelector('.navbar-mobile-logout-btn');
        return {
          drawerVisible: !!drawer,
          itemCount: items.length,
          hasLogout: !!logout
        };
      })()
    `,
    returnByValue: true
  });

  const drawer = drawerCheck.result.value;
  if (drawer.drawerVisible && drawer.itemCount === 6 && drawer.hasLogout) {
    console.log(`✅ Mobile navigation drawer opened cleanly with all ${drawer.itemCount} items and Sign Out button.`);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile_navbar_drawer_verified.png'), Buffer.from(shot.data, 'base64'));
    console.log('   📸 Captured screenshot: mobile_navbar_drawer_verified.png');
  } else {
    console.error('❌ Mobile drawer did not open properly:', drawer);
    process.exit(1);
  }

  // Close browser
  ws.close();
  edge.kill();

  console.log('\n[4/4] Summary:');
  if (totalOverflows === 0) {
    console.log('🎉 PERFECT RESPONSIVE VERIFICATION: 0 horizontal overflows detected across Mobile, Tablet, and Desktop!');
  } else {
    console.error(`❌ Verification finished with ${totalOverflows} overflow issues.`);
    process.exit(1);
  }
}

runResponsiveVerification().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
