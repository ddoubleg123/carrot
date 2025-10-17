// Minimal static file server for Techpulse on port 4000
// Adds lightweight API endpoints for Rocket.Chat OAuth bridge
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

let admin;
try {
  admin = require('firebase-admin');
  if (!admin.apps || !admin.apps.length) {
    // Initialize with ADC or env-provided credentials
    admin.initializeApp();
  }
} catch (_) {
  // firebase-admin not installed or init failed; dev fallback can be enabled via env
}

const PORT = Number(process.env.PORT) || 4000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const RC_TARGET = { host: '127.0.0.1', port: 3100 };

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    const urlPath = decodeURIComponent(u.pathname);

    // Reverse proxy Rocket.Chat under same origin to bypass X-Frame-Options
    if (urlPath === '/rc' || urlPath === '/rc/' || urlPath.startsWith('/rc/')) {
      const rcPath = urlPath.replace(/^\/rc/, '') || '/';
      const options = {
        hostname: RC_TARGET.host,
        port: RC_TARGET.port,
        method: req.method,
        path: rcPath + (u.search || ''),
        headers: { ...req.headers, host: `${RC_TARGET.host}:${RC_TARGET.port}` }
      };
      const proxy = http.request(options, (pr) => {
        const headers = { ...pr.headers };
        // Strip frame-blocking header
        delete headers['x-frame-options'];
        delete headers['X-Frame-Options'];
        // Rewrite redirects back through /rc
        if (headers.location) {
          try {
            const loc = new URL(headers.location, `http://${RC_TARGET.host}:${RC_TARGET.port}`);
            headers.location = `/rc${loc.pathname}${loc.search}`;
          } catch (_) {}
        }
        res.writeHead(pr.statusCode || 502, headers);
        pr.pipe(res);
      });
      proxy.on('error', () => send(res, 502, 'Bad Gateway'));
      req.pipe(proxy);
      return;
    }

    // Rocket.Chat serves endpoints at absolute root. Proxy those only when
    // the request originates from our /rc page (via Referer). This avoids
    // hijacking local assets like /styles.css.
    const referer = req.headers['referer'] || req.headers['referrer'] || '';
    const rcAsset = referer.includes('/rc') && (
      urlPath === '/meteor_runtime_config.js' ||
      urlPath.startsWith('/__meteor__/') ||
      urlPath.startsWith('/sockjs/') ||
      urlPath.startsWith('/_timesync') ||
      (urlPath.startsWith('/api/') && !urlPath.startsWith('/api/auth/')) ||
      (/^\/[A-Za-z0-9._-]+\.(?:js|css)(?:\?.*)?$/).test(urlPath)
    );
    if (rcAsset) {
      const options = {
        hostname: RC_TARGET.host,
        port: RC_TARGET.port,
        method: req.method,
        path: urlPath + (u.search || ''),
        headers: { ...req.headers, host: `${RC_TARGET.host}:${RC_TARGET.port}` }
      };
      const proxy = http.request(options, (pr) => {
        const headers = { ...pr.headers };
        delete headers['x-frame-options'];
        delete headers['X-Frame-Options'];
        res.writeHead(pr.statusCode || 502, headers);
        pr.pipe(res);
      });
      proxy.on('error', () => send(res, 502, 'Bad Gateway'));
      req.pipe(proxy);
      return;
    }

    // API: OAuth token exchange
    if (req.method === 'POST' && urlPath === '/api/auth/token') {
      try {
        const body = await parseJsonBody(req);
        const idToken = body.id_token || body.idToken || body.token;
        if (!idToken) return send(res, 400, JSON.stringify({ error: 'missing id_token' }), { 'Content-Type': 'application/json' });

        if (admin && admin.auth) {
          await admin.auth().verifyIdToken(idToken);
        } else if (process.env.FIREBASE_DEV_ALLOW_UNVERIFIED !== '1') {
          return send(res, 500, JSON.stringify({ error: 'firebase-admin not initialized. Set GOOGLE_APPLICATION_CREDENTIALS or set FIREBASE_DEV_ALLOW_UNVERIFIED=1 for local dev.' }), { 'Content-Type': 'application/json' });
        }

        const resp = { access_token: idToken, token_type: 'bearer', expires_in: 3600 };
        return send(res, 200, JSON.stringify(resp), { 'Content-Type': 'application/json' });
      } catch (e) {
        return send(res, 400, JSON.stringify({ error: 'invalid_request' }), { 'Content-Type': 'application/json' });
      }
    }

    // API: OAuth userinfo
    if (req.method === 'GET' && urlPath === '/api/auth/userinfo') {
      try {
        const authz = req.headers['authorization'] || '';
        const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : null;
        if (!idToken) return send(res, 401, JSON.stringify({ error: 'missing bearer token' }), { 'Content-Type': 'application/json' });

        let decoded = null;
        if (admin && admin.auth) {
          decoded = await admin.auth().verifyIdToken(idToken);
        } else if (process.env.FIREBASE_DEV_ALLOW_UNVERIFIED === '1') {
          // Dev fallback: minimal decoded shape
          decoded = { uid: 'dev-user', email: 'dev@example.com', name: 'Dev User', picture: '' };
        } else {
          return send(res, 500, JSON.stringify({ error: 'firebase-admin not initialized' }), { 'Content-Type': 'application/json' });
        }

        const payload = {
          id: decoded.uid || decoded.user_id || decoded.sub || 'unknown',
          email: decoded.email || '',
          name: decoded.name || decoded.email || 'User',
          picture: decoded.picture || ''
        };
        return send(res, 200, JSON.stringify(payload), { 'Content-Type': 'application/json' });
      } catch (e) {
        return send(res, 401, JSON.stringify({ error: 'invalid_token' }), { 'Content-Type': 'application/json' });
      }
    }

    // Static file handling below
    let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

    // Prevent path traversal
    if (!filePath.startsWith(ROOT)) {
      return send(res, 403, 'Forbidden');
    }

    // If directory, try index.html inside
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      return send(res, 404, 'Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    const stream = fs.createReadStream(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    stream.pipe(res);
    stream.on('error', () => send(res, 500, 'Internal Server Error'));
  } catch (e) {
    send(res, 500, 'Internal Server Error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[techpulse] static server listening on http://127.0.0.1:${PORT}`);
});

// Proxy WebSocket upgrades (SockJS native websocket) to Rocket.Chat
server.on('upgrade', (req, socket, head) => {
  try {
    const target = net.connect(RC_TARGET.port, RC_TARGET.host, () => {
      // Forward the original upgrade request line + headers, overriding Host
      const path = req.url || '/';
      let headerStr = `GET ${path} HTTP/1.1\r\n`;
      const headers = { ...req.headers, host: `${RC_TARGET.host}:${RC_TARGET.port}` };
      for (const [k, v] of Object.entries(headers)) {
        headerStr += `${k}: ${v}\r\n`;
      }
      headerStr += `\r\n`;
      target.write(headerStr);
      if (head && head.length) target.write(head);
      // Bi-directional piping
      target.pipe(socket);
      socket.pipe(target);
    });
    target.on('error', () => { try { socket.destroy(); } catch(_){} });
  } catch(_) { try { socket.destroy(); } catch(_){} }
});
