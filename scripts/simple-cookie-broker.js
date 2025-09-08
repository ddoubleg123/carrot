// Simple Cookie Broker for local testing (no external deps)
// Usage:
//   $env:COOKIE_BROKER_SECRET="<secret>"
//   $env:COOKIE_SOURCE_FILE="C:\\Users\\danie\\Downloads\\yt-cookies.txt"   # Netscape format
//   node scripts/simple-cookie-broker.js
// Endpoint:
//   GET/POST http://localhost:3005/api/cookie-broker?userId=<id>
// Headers:
//   Authorization: Bearer <secret>

const http = require('http');
const url = require('url');
const fs = require('fs');

const PORT = Number(process.env.PORT || 3005);
const SECRET = process.env.COOKIE_BROKER_SECRET || process.env.COOKIE_FETCH_SECRET || '';
const COOKIE_SOURCE_FILE = process.env.COOKIE_SOURCE_FILE || '';
const DEFAULT_UA = process.env.BROKER_UA || '';
const DEFAULT_PLAYER_CLIENT = process.env.BROKER_YT_PLAYER_CLIENT || '';

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': body.length });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const txt = Buffer.concat(chunks).toString('utf8');
        resolve(txt ? JSON.parse(txt) : {});
      } catch (_) {
        resolve({});
      }
    });
  });
}

function isAuthorized(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  return Boolean(SECRET) && token === SECRET;
}

function readCookiesB64() {
  if (!COOKIE_SOURCE_FILE || !fs.existsSync(COOKIE_SOURCE_FILE)) return null;
  const buf = fs.readFileSync(COOKIE_SOURCE_FILE);
  return buf.toString('base64');
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '';

  if (pathname !== '/api/cookie-broker') {
    return sendJson(res, 404, { error: 'not found' });
  }
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  let userId = parsed.query.userId || parsed.query.user_id || req.headers['x-user-id'] || '';
  if (req.method === 'POST') {
    const body = await readBody(req);
    userId = body.userId || body.user_id || userId || '';
  }
  if (!userId) {
    return sendJson(res, 400, { error: 'missing userId' });
  }
  const b64 = readCookiesB64();
  if (!b64) {
    return sendJson(res, 503, { error: 'no cookies available', file: COOKIE_SOURCE_FILE || null });
  }
  return sendJson(res, 200, { b64, ua: DEFAULT_UA || undefined, playerClient: DEFAULT_PLAYER_CLIENT || undefined });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[cookie-broker] listening on http://localhost:${PORT}`);
  console.log(`[cookie-broker] COOKIE_SOURCE_FILE=${COOKIE_SOURCE_FILE || 'unset'}`);
});
