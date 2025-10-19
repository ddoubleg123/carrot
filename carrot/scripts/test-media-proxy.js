/**
 * Test Media Proxy Endpoint
 */

async function testMediaProxy() {
  console.log('🔍 Testing media proxy endpoint...\n');

  const baseUrl = 'https://carrot-app.onrender.com';
  const testUrl = '/api/media/proxy?url=https%3A%2F%2Fcdn.nba.com%2Fteams%2Fuploads%2Fsites%2F1610612741%2F2022%2F04%2Fbullhead-1819.png&w=1280&f=webp&q=80';
  
  console.log(`Testing: ${baseUrl}${testUrl}`);
  
  try {
    const response = await fetch(`${baseUrl}${testUrl}`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      console.log(`✅ Success! Content-Type: ${contentType}, Length: ${contentLength}`);
    } else {
      console.log(`❌ Failed to load image`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testMediaProxy().catch(console.error);
