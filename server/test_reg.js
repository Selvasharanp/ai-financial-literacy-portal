const http = require('http');

const data = JSON.stringify({
  name: 'Automated Test User',
  email: `test_${Date.now()}@example.com`,
  password: 'Password123!'
});

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('HTTP_STATUS:', res.statusCode);
    console.log('HTTP_BODY:', body);
  });
});

req.on('error', (err) => console.error('HTTP_ERROR:', err.message));
req.write(data);
req.end();
