/**
 * Custom Next.js server with aggressive HTTP/1.1 forcing
 * This ensures all connections use HTTP/1.1 instead of HTTP/2
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP/1.1 server (NOT http2)
  const server = createServer((req, res) => {
    try {
      // Force HTTP/1.1 response headers
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Keep-Alive', 'timeout=5, max=1000');
      
      // Explicitly disable HTTP/2
      res.setHeader('HTTP-Version', '1.1');
      
      // Parse URL
      const parsedUrl = parse(req.url, true);
      
      // Handle the request with Next.js
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling request:', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Configure server for HTTP/1.1
  server.keepAliveTimeout = 65000; // 65 seconds (longer than typical load balancer timeout)
  server.headersTimeout = 66000; // Must be greater than keepAliveTimeout
  
  server.once('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port} (HTTP/1.1 only)`);
    console.log('> HTTP/2 disabled - using HTTP/1.1 for all connections');
  });
});

