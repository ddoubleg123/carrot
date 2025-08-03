const fs = require('fs');
const path = require('path');

// Adjust this path to your Next.js server log file
const LOG_PATH = path.resolve(__dirname, '../.next/server/logs/server.log');
const SESSION_MARKER = '[SESSION CALLBACK]';

function parseSession(line) {
  try {
    const idx = line.indexOf(SESSION_MARKER);
    if (idx === -1) return null;
    const jsonStart = line.indexOf('{', idx);
    if (jsonStart === -1) return null;
    const json = JSON.parse(line.slice(jsonStart));
    const tokenStr = JSON.stringify(json.token);
    const sessionStr = JSON.stringify(json.session);
    return {
      tokenLength: tokenStr.length,
      sessionLength: sessionStr.length,
      tokenPreview: tokenStr.slice(0, 200),
      sessionPreview: sessionStr.slice(0, 200),
    };
  } catch (e) {
    return null;
  }
}

console.log('Tailing server log for session bloat...');
fs.watchFile(LOG_PATH, { interval: 2000 }, (curr, prev) => {
  if (curr.size === prev.size) return;
  const stream = fs.createReadStream(LOG_PATH, {
    start: prev.size,
    end: curr.size,
    encoding: 'utf8',
  });
  stream.on('data', (chunk) => {
    chunk.split('\n').forEach(line => {
      if (line.includes(SESSION_MARKER)) {
        const parsed = parseSession(line);
        if (parsed) {
          if (parsed.tokenLength > 4000 || parsed.sessionLength > 4000) {
            console.error('[ALERT] Large token/session detected:', parsed);
          } else {
            console.log('[SESSION]', parsed);
          }
        }
      }
    });
  });
});
