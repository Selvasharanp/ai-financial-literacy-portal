const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9370;

async function test() {
  const edge = spawn(EDGE_PATH, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
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
  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const cur = id++;
    ws.send(JSON.stringify({ id: cur, method: m, params: p }));
    const handler = e => {
      const msg = JSON.parse(e.data);
      if (msg.id === cur) {
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
  });

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:5173/login' });
  await new Promise(r => setTimeout(r, 2000));

  const res = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      return {
        isLoaded: document.fonts.check("16px 'DM Serif Display'"),
        fontFaces: Array.from(document.fonts).map(f => ({ family: f.family, status: f.status, weight: f.weight }))
      };
    })()`
  });

  console.log('Font load status:', JSON.stringify(res.result.value, null, 2));

  ws.close();
  edge.kill();
}

test().catch(console.error);
