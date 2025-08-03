const http = require('http');

const HOST = 'localhost';
const PORT = 3005;
const PATH = '/api/debug-cookies';
const THRESHOLD = 4096; // 4KB
const INTERVAL = 10000; // 10 seconds

function checkCookies() {
  const options = {
    hostname: HOST,
    port: PORT,
    path: PATH,
    method: 'GET',
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const oversized = json.cookieSizes.filter(c => c.size > THRESHOLD);
        if (oversized.length > 0) {
          console.error(`[ALERT] Oversized cookies detected:`, oversized);
        } else {
          console.log(`[${new Date().toISOString()}] All cookies OK.`, json.cookieSizes);
        }
      } catch (e) {
        console.error('Failed to parse response:', e, data);
      }
    });
  });
  req.on('error', (e) => {
    console.error('Request error:', e);
  });
  req.end();
}

console.log('Starting cookie monitor...');
setInterval(checkCookies, INTERVAL);
checkCookies();
