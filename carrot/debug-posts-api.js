// Debug script to test posts API and see what data is returned
const fetch = require('node-fetch');

async function testPostsAPI() {
  try {
    console.log('🔍 Testing posts API...');
    const response = await fetch('http://localhost:3005/api/posts', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('❌ API request failed');
      return;
    }
    
    const posts = await response.json();
    console.log('📝 Posts returned:', posts.length);
    
    if (posts.length > 0) {
      console.log('🎯 First post sample:');
      console.log('- ID:', posts[0].id);
      console.log('- Content:', posts[0].content?.substring(0, 50) + '...');
      console.log('- User:', posts[0].User?.username || 'No username');
      console.log('- Created:', posts[0].createdAt);
      console.log('- Gradient:', posts[0].gradientFromColor, '→', posts[0].gradientToColor);
    } else {
      console.log('⚠️ No posts found in API response');
    }
    
  } catch (error) {
    console.error('💥 Error testing posts API:', error.message);
  }
}

testPostsAPI();
