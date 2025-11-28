/**
 * Custom Next.js server with aggressive HTTP/1.1 forcing
 * This ensures all connections use HTTP/1.1 instead of HTTP/2
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Validate environment at boot
// Note: In production, this will be called during build/start
// For development, we validate here
if (process.env.NODE_ENV !== 'test') {
  try {
    // Use dynamic import for TypeScript module
    // In production, this will be compiled to .js
    const validateModule = require('./src/lib/env/validate.js');
    if (validateModule && validateModule.validateEnv) {
      validateModule.validateEnv();
    }
  } catch (error) {
    // In dev, TypeScript files may not be compiled yet - that's OK
    // Validation will happen when the app starts
    console.warn('[Boot] Environment validation skipped (will validate at runtime):', error.message);
  }
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Verify Playwright installation at startup
  try {
    const { execSync } = require('child_process');
    const { existsSync } = require('fs');
    const playwright = require('playwright');
    
    // Check if Chromium executable exists
    const executablePath = playwright.chromium.executablePath();
    if (!existsSync(executablePath)) {
      console.warn('[STARTUP] Playwright Chromium not found, attempting installation...');
      try {
        execSync('npx playwright install chromium', { stdio: 'inherit', timeout: 120000 });
        console.log('[STARTUP] Playwright Chromium installed successfully');
      } catch (installError) {
        console.error('[STARTUP] Failed to install Playwright Chromium:', installError.message);
        console.error('[STARTUP] Discovery engine may not work correctly without Playwright');
      }
    } else {
      console.log('[STARTUP] Playwright Chromium verified:', executablePath);
    }
  } catch (error) {
    console.warn('[STARTUP] Playwright verification skipped:', error.message);
  }

  // Create HTTP/1.1 server (NOT http2)
  const server = createServer((req, res) => {
    try {
      // Force HTTP/1.1 response headers
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Keep-Alive', 'timeout=5, max=1000');
      
      // Explicitly disable HTTP/2
      res.setHeader('HTTP-Version', '1.1');
      res.setHeader('X-HTTP-Version', '1.1');
      res.setHeader('X-Protocol', 'HTTP/1.1');
      res.setHeader('X-Force-HTTP1', 'true');
      res.setHeader('X-Disable-HTTP2', 'true');
      
      // Disable HTTP/2 features
      res.setHeader('Alt-Svc', '');
      res.setHeader('HTTP2-Settings', '');
      
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

