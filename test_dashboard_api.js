const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function run() {
  try {
    const email = 'directlink' + Date.now() + '@test.com';
    console.log('--- 1. REGISTER ---');
    const reg = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: 'Direct Link User', email, password: 'password123' });
    console.log('Status:', reg.status, 'Token:', reg.data.token ? 'YES' : 'NO');

    const token = reg.data.token;
    const headers = { 'Authorization': 'Bearer ' + token };

    console.log('\n--- 2. GET /api/auth/profile ---');
    const profile = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/auth/profile', method: 'GET', headers });
    console.log('Status:', profile.status, profile.data);

    console.log('\n--- 3. GET /api/transactions/summary ---');
    const summary = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/transactions/summary', method: 'GET', headers });
    console.log('Status:', summary.status, summary.data);

    console.log('\n--- 4. GET /api/transactions ---');
    const tx = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/transactions', method: 'GET', headers });
    console.log('Status:', tx.status, 'IsArray:', Array.isArray(tx.data), tx.data);

    console.log('\n--- 5. GET /api/goals ---');
    const goals = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/goals', method: 'GET', headers });
    console.log('Status:', goals.status, 'IsArray:', Array.isArray(goals.data), goals.data);

    console.log('\n--- 6. GET /api/ai/insights ---');
    const insights = await request({ hostname: '127.0.0.1', port: 5000, path: '/api/ai/insights', method: 'GET', headers });
    console.log('Status:', insights.status, 'IsArray:', Array.isArray(insights.data), insights.data);

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
