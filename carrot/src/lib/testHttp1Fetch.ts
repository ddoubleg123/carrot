/**
 * Test script for HTTP/1.1 forcing mechanism
 * This can be used to verify that the HTTP/1.1 forcing is working correctly
 */

import { http1Fetch, getHTTP1RetryStats, resetHTTP1RetryCounts } from './http1Fetch';

export async function testHTTP1Fetch() {
  console.log('🧪 Testing HTTP/1.1 forcing mechanism...');
  
  const testUrls = [
    'https://httpbin.org/headers',
    'https://httpbin.org/get',
    'https://httpbin.org/status/200',
  ];
  
  const results: Record<string, any> = {};
  
  for (const url of testUrls) {
    try {
      console.log(`\n📡 Testing: ${url}`);
      const startTime = Date.now();
      
      const response = await http1Fetch(url, {
        method: 'GET',
        maxRetries: 2,
        retryDelay: 1000
      });
      
      const responseTime = Date.now() - startTime;
      const data = await response.json();
      
      results[url] = {
        success: true,
        status: response.status,
        responseTime,
        headers: data.headers,
        httpVersion: data.headers['X-Forwarded-Proto'] || 'unknown'
      };
      
      console.log(`✅ Success: ${response.status} (${responseTime}ms)`);
      console.log(`   HTTP Version: ${results[url].httpVersion}`);
      
    } catch (error) {
      results[url] = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      console.log(`❌ Failed: ${results[url].error}`);
    }
  }
  
  console.log('\n📊 Retry Statistics:');
  console.log(JSON.stringify(getHTTP1RetryStats(), null, 2));
  
  console.log('\n📋 Test Results Summary:');
  console.log(JSON.stringify(results, null, 2));
  
  return results;
}

export async function testFirebaseStorage() {
  console.log('\n🔥 Testing Firebase Storage with HTTP/1.1 forcing...');
  
  // Test with a simple Firebase Storage URL
  const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/involuted-river-466315-p0.firebasestorage.app/o/test%2Ftest.txt?alt=media';
  
  try {
    const response = await http1Fetch(firebaseUrl, {
      method: 'HEAD',
      maxRetries: 2,
      retryDelay: 1000
    });
    
    console.log(`✅ Firebase Storage HEAD request: ${response.status}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    
    return { success: true, status: response.status };
  } catch (error) {
    console.log(`❌ Firebase Storage test failed:`, error instanceof Error ? error.message : 'Unknown error');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Export a function to run all tests
export async function runAllTests() {
  console.log('🚀 Starting comprehensive HTTP/1.1 forcing tests...\n');
  
  // Reset retry stats before testing
  resetHTTP1RetryCounts();
  
  const http1Results = await testHTTP1Fetch();
  const firebaseResults = await testFirebaseStorage();
  
  console.log('\n🎯 Final Results:');
  console.log('HTTP/1.1 Tests:', http1Results);
  console.log('Firebase Storage Tests:', firebaseResults);
  
  return {
    http1: http1Results,
    firebase: firebaseResults,
    retryStats: getHTTP1RetryStats()
  };
}

// Make functions available globally for browser testing
if (typeof window !== 'undefined') {
  (window as any).testHTTP1Fetch = testHTTP1Fetch;
  (window as any).testFirebaseStorage = testFirebaseStorage;
  (window as any).runAllTests = runAllTests;
  (window as any).getHTTP1RetryStats = getHTTP1RetryStats;
  (window as any).resetHTTP1RetryCounts = resetHTTP1RetryCounts;
}
