const fetch = require('node-fetch');

async function testAPI() {
  try {
    const response = await fetch('http://localhost:3005/api/posts');
    const posts = await response.json();
    
    console.log('Total posts:', posts.length);
    
    if (posts.length > 0) {
      const firstPost = posts[0];
      console.log('\nFirst post data:');
      console.log('ID:', firstPost.id);
      console.log('imageUrls:', firstPost.imageUrls);
      console.log('imageUrls type:', typeof firstPost.imageUrls);
      console.log('hasVideo:', firstPost.hasVideo);
      console.log('hasAudio:', firstPost.hasAudio);
      
      if (firstPost.imageUrls) {
        console.log('imageUrls length:', firstPost.imageUrls.length);
        console.log('First image URL:', firstPost.imageUrls[0]);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();
