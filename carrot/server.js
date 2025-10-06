const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 10000;

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP/1.1 server explicitly
  const server = createServer((req, res) => {
    try {
      // Force HTTP/1.1 headers
      res.setHeader('Connection', 'close');
      res.setHeader('Upgrade', 'HTTP/1.1');
      res.setHeader('Alt-Svc', 'clear');
      res.setHeader('HTTP2-Settings', '');
      res.setHeader('X-Forwarded-Proto', 'http');
      
      // Parse URL and handle request
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Disable HTTP/2 on the server
  server.on('upgrade', (request, socket, head) => {
    console.log('HTTP/2 upgrade attempt blocked');
    socket.destroy();
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log('> HTTP/1.1 server started (HTTP/2 disabled)');
  });
});
