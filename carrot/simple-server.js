const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head><title>Test Server</title></head>
      <body>
        <h1>🧪 Test Server is Working!</h1>
        <p>Time: ${new Date().toISOString()}</p>
        <p>URL: ${req.url}</p>
        <h2>Test Image Generation</h2>
        <button onclick="testAPI()">Test API</button>
        <div id="result"></div>
        <script>
          function testAPI() {
            fetch('/api/test')
              .then(r => r.json())
              .then(d => document.getElementById('result').innerHTML = '<pre>' + JSON.stringify(d, null, 2) + '</pre>')
              .catch(e => document.getElementById('result').innerHTML = 'Error: ' + e);
          }
        </script>
      </body>
    </html>
  `);
});

const PORT = 3005;
server.listen(PORT, () => {
  console.log(`✅ Simple test server running on http://localhost:${PORT}`);
  console.log('🎯 Open your browser and go to: http://localhost:3005');
});
