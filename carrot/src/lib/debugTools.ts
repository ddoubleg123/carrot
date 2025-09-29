// Debug tools for video loading diagnostics
// Usage: Call these functions in browser console

export const enableVideoDiagnostics = () => {
  localStorage.setItem('VIDEO_DIAGNOSTICS', '1');
  console.log('✅ Video diagnostics enabled. Refresh the page to see diagnostics.');
};

export const enableNetworkMonitor = () => {
  localStorage.setItem('NETWORK_MONITOR', '1');
  console.log('✅ Network performance monitor enabled. Refresh the page to see monitoring.');
};

export const enableAllDebugTools = () => {
  enableVideoDiagnostics();
  enableNetworkMonitor();
  console.log('✅ All debug tools enabled. Refresh the page to see all diagnostics.');
};

export const disableAllDebugTools = () => {
  localStorage.removeItem('VIDEO_DIAGNOSTICS');
  localStorage.removeItem('NETWORK_MONITOR');
  console.log('✅ All debug tools disabled. Refresh the page to hide diagnostics.');
};

export const testVideoUrl = async (url: string) => {
  console.log(`🔍 Testing video URL: ${url}`);
  
  try {
    // Test 1: HEAD request
    console.log('📡 Testing HEAD request...');
    const headStart = Date.now();
    const headResponse = await fetch(url, { method: 'HEAD' });
    const headDuration = Date.now() - headStart;
    
    console.log('HEAD Response:', {
      status: headResponse.status,
      statusText: headResponse.statusText,
      duration: `${headDuration}ms`,
      headers: Object.fromEntries(headResponse.headers.entries())
    });

    // Test 2: Range request (first 1MB)
    console.log('📡 Testing Range request (first 1MB)...');
    const rangeStart = Date.now();
    const rangeResponse = await fetch(url, {
      method: 'GET',
      headers: { 'Range': 'bytes=0-1048576' }
    });
    const rangeDuration = Date.now() - rangeStart;
    
    console.log('Range Response:', {
      status: rangeResponse.status,
      statusText: rangeResponse.statusText,
      duration: `${rangeDuration}ms`,
      contentLength: rangeResponse.headers.get('content-length'),
      contentRange: rangeResponse.headers.get('content-range'),
      acceptRanges: rangeResponse.headers.get('accept-ranges')
    });

    // Test 3: Full video element test
    console.log('🎥 Testing video element...');
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    
    const videoStart = Date.now();
    let metadataLoaded = false;
    let canPlay = false;
    
    video.addEventListener('loadedmetadata', () => {
      metadataLoaded = true;
      console.log('✅ Video metadata loaded:', {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        timeToMetadata: `${Date.now() - videoStart}ms`
      });
    });
    
    video.addEventListener('canplay', () => {
      canPlay = true;
      console.log('✅ Video can play:', {
        readyState: video.readyState,
        networkState: video.networkState,
        timeToCanPlay: `${Date.now() - videoStart}ms`
      });
    });
    
    video.addEventListener('error', (e) => {
      console.error('❌ Video error:', {
        error: video.error,
        timeToError: `${Date.now() - videoStart}ms`
      });
    });
    
    video.src = url;
    video.load();
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (!metadataLoaded) {
        console.warn('⚠️ Video metadata not loaded after 30 seconds');
      }
      if (!canPlay) {
        console.warn('⚠️ Video cannot play after 30 seconds');
      }
    }, 30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).enableVideoDiagnostics = enableVideoDiagnostics;
  (window as any).enableNetworkMonitor = enableNetworkMonitor;
  (window as any).enableAllDebugTools = enableAllDebugTools;
  (window as any).disableAllDebugTools = disableAllDebugTools;
  (window as any).testVideoUrl = testVideoUrl;
  
  console.log('🔧 Debug tools loaded! Available commands:');
  console.log('  enableVideoDiagnostics() - Enable video loading diagnostics');
  console.log('  enableNetworkMonitor() - Enable network performance monitoring');
  console.log('  enableAllDebugTools() - Enable all debug tools');
  console.log('  disableAllDebugTools() - Disable all debug tools');
  console.log('  testVideoUrl(url) - Test a specific video URL');
}
