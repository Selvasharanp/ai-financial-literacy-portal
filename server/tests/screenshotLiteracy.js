// server/tests/screenshotLiteracy.js
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

  console.log('User:', user.name, 'Token ready.');

  // Launch Edge with remote debugging
  const port = 9333;
  const edge = spawn(EDGE_PATH, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--window-size=1280,900',
    'http://localhost:5173/'
  ]);

  // Wait for edge to start
  await new Promise(r => setTimeout(r, 2000));

  // Get debug targets
  const versionInfo = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/version`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const targets = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/list`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find(t => t.type === 'page');
  if (!pageTarget) {
    console.error('No page target found');
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

  await new Promise(resolve => {
    ws.onopen = resolve;
  });

  console.log('Connected to CDP. Setting auth token...');
  await send('Page.enable');
  await send('Runtime.enable');

  // Set localStorage
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('token', '${token}');
      localStorage.setItem('user', JSON.stringify(${userData}));
    `
  });

  // Navigate to literacy hub
  console.log('Navigating to /literacy...');
  await send('Page.navigate', { url: 'http://localhost:5173/literacy' });

  // Wait for page to render
  await new Promise(r => setTimeout(r, 3000));

  // Capture screenshot of Tab 1 (Learn One Concept)
  console.log('Capturing screenshot of Tab 1 (Learn)...');
  const screenshot1 = await send('Page.captureScreenshot', { format: 'png' });
  const outPath1 = path.join(ARTIFACT_DIR, 'literacy_hub_learn_tab.png');
  fs.writeFileSync(outPath1, Buffer.from(screenshot1.data, 'base64'));
  console.log('Saved:', outPath1);

  // Scroll down to example & activity
  console.log('Scrolling down to capture activity...');
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 950);' });
  await new Promise(r => setTimeout(r, 1000));
  const screenshotActivity = await send('Page.captureScreenshot', { format: 'png' });
  const outPathActivity = path.join(ARTIFACT_DIR, 'literacy_hub_calculator_takeaway.png');
  fs.writeFileSync(outPathActivity, Buffer.from(screenshotActivity.data, 'base64'));
  console.log('Saved:', outPathActivity);

  // Scroll back top
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0);' });
  await new Promise(r => setTimeout(r, 500));

  // Click on Ask AI tab
  console.log('Clicking on Ask AI tab...');
  await send('Runtime.evaluate', {
    expression: `
      const buttons = Array.from(document.querySelectorAll('.literacy-tab-btn, button'));
      const askBtn = buttons.find(b => b.textContent.includes('Ask AI'));
      if (askBtn) askBtn.click();
    `
  });

  await new Promise(r => setTimeout(r, 1500));

  console.log('Capturing screenshot of Tab 2 (Ask AI)...');
  const screenshot2 = await send('Page.captureScreenshot', { format: 'png' });
  const outPath2 = path.join(ARTIFACT_DIR, 'literacy_hub_ask_ai_tab.png');
  fs.writeFileSync(outPath2, Buffer.from(screenshot2.data, 'base64'));
  console.log('Saved:', outPath2);

  // Inspect DOM metrics
  const domMetrics = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const wrapper = document.querySelector('.literacy-wrapper');
        const tabs = document.querySelectorAll('.literacy-tab-btn');
        const topicGrid = document.querySelector('.topic-nav-grid');
        const topicCards = document.querySelectorAll('.topic-item-card');
        const lessonCard = document.querySelector('.lesson-card-container');
        const askAiCard = document.querySelector('.ask-ai-card-container');
        
        return {
          wrapperWidth: wrapper ? wrapper.offsetWidth : 0,
          tabCount: tabs.length,
          topicCount: topicCards.length,
          hasLessonCard: !!lessonCard,
          hasAskAiCard: !!askAiCard,
          firstTopicRect: topicCards[0] ? topicCards[0].getBoundingClientRect() : null,
          secondTopicRect: topicCards[1] ? topicCards[1].getBoundingClientRect() : null
        };
      })()
    `,
    returnByValue: true
  });

  console.log('DOM Layout Metrics:', JSON.stringify(domMetrics.result.value, null, 2));

  ws.close();
  edge.kill();
  console.log('Verification finished successfully!');
}

main().catch(err => {
  console.error('Error during screenshot test:', err);
  process.exit(1);
});
