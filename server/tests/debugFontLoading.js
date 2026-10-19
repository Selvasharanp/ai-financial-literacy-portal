const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9380;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
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

  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const cur = id++;
    ws.send(JSON.stringify({ id: cur, method: m, params: p }));
    const handler = e => {
      const msg = JSON.parse(e.data);
      if (msg.id === cur) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
  });

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  const failedRequests = [];
  ws.addEventListener('message', e => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Network.loadingFailed') {
      failedRequests.push(msg.params);
    }
    if (msg.method === 'Network.responseReceived') {
      if (msg.params.response.url.includes('font')) {
        console.log('Font network response:', msg.params.response.url, msg.params.response.status);
      }
    }
  });

  await send('Page.navigate', { url: 'http://localhost:5173/login' });
  await new Promise(r => setTimeout(r, 4000));

  const res = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(async () => {
      await document.fonts.ready;
      const fonts = Array.from(document.fonts).map(f => ({
        family: f.family,
        status: f.status,
        weight: f.weight,
        style: f.style
      }));

      // Let's force load DM Serif Display
      let loadedResult = null;
      try {
        const loaded = await document.fonts.load("16px 'DM Serif Display'");
        loadedResult = loaded.map(f => ({ family: f.family, status: f.status }));
      } catch (err) {
        loadedResult = err.message;
      }

      return {
        allFontFaces: fonts,
        loadedResult,
        checkQuotes: document.fonts.check("16px 'DM Serif Display'"),
        checkNoQuotes: document.fonts.check('16px DM Serif Display')
      };
    })()`,
    awaitPromise: true
  });

  console.log('Font inspection result:', JSON.stringify(res.result.value, null, 2));
  if (failedRequests.length) {
    console.log('Failed network requests:', failedRequests);
  }

  ws.close();
  edge.kill();
}

run().catch(console.error);
