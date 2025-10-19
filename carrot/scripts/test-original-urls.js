/**
 * Test Original Image URLs
 */

async function testOriginalUrls() {
  console.log('🔍 Testing original image URLs...\n');

  const testUrls = [
    'https://cdn.nba.com/teams/uploads/sites/1610612741/2022/04/bullhead-1819.png',
    'https://occ-0-2186-2164.1.nflxso.net/dnm/api/v6/E8vDc_W8CLv7-yMQu8KMEC7Rrr8/AAAABXimRVuqt_FUI7wme0nZGOStVRnC-BFb8o7s5XdaIvCzbaq2rft1YOnaqjM7uxANq8eGaWcgi1ZbOyl986spC8RAcpT7GZQh2QQj.jpg?r=627'
  ];

  for (const url of testUrls) {
    console.log(`\n📄 Testing: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0; +https://carrot.app/bot)'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        console.log(`   ✅ Success! Content-Type: ${contentType}, Length: ${contentLength}`);
      } else {
        console.log(`   ❌ Failed to load image`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

testOriginalUrls().catch(console.error);
