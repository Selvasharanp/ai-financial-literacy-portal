const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testAuthInBrowser() {
  console.log('--- TESTING BROWSER AUTHENTICATION ON LOCALHOST:5173 ---');

  const port = 9370;
  const edge = spawn(EDGE_PATH, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--window-size=1280,900',
    'http://localhost:5173/login'
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

  const consoleLogs = [];
  const networkErrors = [];

  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      consoleLogs.push(msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Network.loadingFailed') {
      networkErrors.push(msg.params);
    }
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
  await send('Network.enable');

  await send('Page.navigate', { url: 'http://localhost:5173/login' });
  await new Promise(r => setTimeout(r, 1500));

  console.log('[1] Logging in via form inputs...');
  await send('Runtime.evaluate', {
    expression: `
      (function() {
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(emailInput, 'suresh@example.com');
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));

        nativeInputValueSetter.call(passInput, 'password123');
        passInput.dispatchEvent(new Event('input', { bubbles: true }));

        submitBtn.click();
      })()
    `
  });

  await new Promise(r => setTimeout(r, 2000));

  const afterLogin = await send('Runtime.evaluate', {
    expression: `
      ({
        token: localStorage.getItem('token'),
        pathname: window.location.pathname,
        error: document.querySelector('[role="alert"], .error, div[style*="fef2f2"]')?.innerText
      })
    `,
    returnByValue: true
  });

  console.log('Result after login submission:', afterLogin.result.value);

  if (consoleLogs.length) {
    console.log('Browser console logs during test:', consoleLogs);
  }
  if (networkErrors.length) {
    console.log('Network failures:', networkErrors);
  }

  ws.close();
  edge.kill();
}

testAuthInBrowser().catch(console.error);
