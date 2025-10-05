// Debug script to check image loading issues
// Run this in the browser console on your newsfeed page

console.log('🔍 Debugging Image Loading Issues...');

// Check if images are being requested
const images = document.querySelectorAll('img');
console.log(`Found ${images.length} images on page`);

images.forEach((img, index) => {
  console.log(`Image ${index + 1}:`, {
    src: img.src,
    alt: img.alt,
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    loading: img.loading
  });
});

// Check for failed image loads
const failedImages = Array.from(images).filter(img => !img.complete || img.naturalWidth === 0);
console.log(`Failed images: ${failedImages.length}`);

failedImages.forEach((img, index) => {
  console.log(`Failed image ${index + 1}:`, {
    src: img.src,
    error: img.onerror ? 'Has error handler' : 'No error handler'
  });
});

// Check network requests
console.log('📡 Checking network requests...');
const networkEntries = performance.getEntriesByType('resource');
const imageRequests = networkEntries.filter(entry => 
  entry.name.includes('/api/img') || 
  entry.name.includes('firebasestorage') ||
  entry.name.includes('storage.googleapis')
);

console.log(`Found ${imageRequests.length} image-related network requests:`);
imageRequests.forEach((entry, index) => {
  console.log(`Request ${index + 1}:`, {
    url: entry.name,
    duration: entry.duration,
    transferSize: entry.transferSize,
    responseStatus: entry.responseStatus || 'unknown'
  });
});

// Test Firebase storage access
console.log('🔥 Testing Firebase Storage Access...');
fetch('/api/img?url=' + encodeURIComponent('https://firebasestorage.googleapis.com/v0/b/test/o/test.jpg?alt=media'))
  .then(response => {
    console.log('Firebase test response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
  })
  .catch(error => {
    console.error('Firebase test error:', error);
  });

// Check environment variables (if accessible)
console.log('🌍 Environment Check:');
console.log('Current domain:', window.location.hostname);
console.log('Is HTTPS:', window.location.protocol === 'https:');

// Check for CORS errors
window.addEventListener('error', (event) => {
  if (event.target.tagName === 'IMG') {
    console.error('Image load error:', {
      src: event.target.src,
      error: event.error
    });
  }
});

console.log('✅ Debug complete. Check the console output above for issues.');
