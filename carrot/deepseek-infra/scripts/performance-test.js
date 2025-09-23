#!/usr/bin/env node

/**
 * Performance Testing Script
 * Measures latency and throughput for SLO validation
 */

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.DEEPSEEK_URL || 'http://localhost:8080';
const CONCURRENT_REQUESTS = 10;
const TOTAL_REQUESTS = 100;

// Test cases
const testCases = [
  {
    name: 'Editor Task (6.7B)',
    taskType: 'editor',
    payload: {
      messages: [{ role: 'user', content: 'Fix this: The code is not working good.' }],
      max_tokens: 100,
      temperature: 0.2
    },
    expectedModel: 'deepseek-coder:6.7b',
    targetP95: 2000 // 2 seconds
  },
  {
    name: 'Refactor Task (16B)',
    taskType: 'refactor_hook@v1',
    payload: {
      messages: [{ role: 'user', content: 'Extract this state into a hook:\nconst [count, setCount] = useState(0);' }],
      max_tokens: 500,
      temperature: 0.2
    },
    expectedModel: 'deepseek-coder-v2:16b',
    targetP95: 4000 // 4 seconds
  },
  {
    name: 'Tests Task (16B)',
    taskType: 'explain_tests@v1',
    payload: {
      messages: [{ role: 'user', content: 'Create tests for: function add(a, b) { return a + b; }' }],
      max_tokens: 800,
      temperature: 0.2
    },
    expectedModel: 'deepseek-coder-v2:16b',
    targetP95: 4000 // 4 seconds
  }
];

// Make a single request and measure latency
const makeRequest = async (testCase) => {
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Task-Type': testCase.taskType
      },
      body: JSON.stringify(testCase.payload)
    });
    
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      latency,
      model: data.model,
      tokens: data.usage?.total_tokens || 0,
      cacheHit: data.usage?.cache_hit || false
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      success: false,
      latency: endTime - startTime,
      error: error.message
    };
  }
};

// Run concurrent requests
const runConcurrentTest = async (testCase, concurrency = CONCURRENT_REQUESTS) => {
  const promises = [];
  
  for (let i = 0; i < concurrency; i++) {
    promises.push(makeRequest(testCase));
  }
  
  return Promise.all(promises);
};

// Calculate percentiles
const calculatePercentiles = (latencies, percentiles = [50, 90, 95, 99]) => {
  const sorted = latencies.sort((a, b) => a - b);
  const results = {};
  
  percentiles.forEach(p => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    results[`p${p}`] = sorted[index] || 0;
  });
  
  return results;
};

// Run performance test
const runPerformanceTest = async () => {
  console.log('🚀 DeepSeek Coder Performance Test');
  console.log('==================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Total requests per test: ${TOTAL_REQUESTS}`);
  console.log('');
  
  for (const testCase of testCases) {
    console.log(`📊 Testing: ${testCase.name}`);
    console.log(`Expected model: ${testCase.expectedModel}`);
    console.log(`Target P95: ${testCase.targetP95}ms`);
    console.log('');
    
    const results = [];
    const iterations = Math.ceil(TOTAL_REQUESTS / CONCURRENT_REQUESTS);
    
    // Run test in batches
    for (let i = 0; i < iterations; i++) {
      const batchResults = await runConcurrentTest(testCase);
      results.push(...batchResults);
      
      // Progress indicator
      const progress = Math.min((i + 1) * CONCURRENT_REQUESTS, TOTAL_REQUESTS);
      process.stdout.write(`\rProgress: ${progress}/${TOTAL_REQUESTS} requests`);
    }
    
    console.log('\n');
    
    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const latencies = successful.map(r => r.latency);
    const cacheHits = successful.filter(r => r.cacheHit).length;
    const totalTokens = successful.reduce((sum, r) => sum + r.tokens, 0);
    
    // Calculate statistics
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const percentiles = calculatePercentiles(latencies);
    
    // Check SLO compliance
    const p95Compliant = percentiles.p95 <= testCase.targetP95;
    const successRate = (successful.length / results.length) * 100;
    
    // Display results
    console.log(`✅ Success rate: ${successRate.toFixed(1)}% (${successful.length}/${results.length})`);
    console.log(`⚡ Average latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`📈 Latency range: ${minLatency.toFixed(0)}ms - ${maxLatency.toFixed(0)}ms`);
    console.log(`📊 Percentiles:`);
    console.log(`   P50: ${percentiles.p50.toFixed(0)}ms`);
    console.log(`   P90: ${percentiles.p90.toFixed(0)}ms`);
    console.log(`   P95: ${percentiles.p95.toFixed(0)}ms ${p95Compliant ? '✅' : '❌'}`);
    console.log(`   P99: ${percentiles.p99.toFixed(0)}ms`);
    console.log(`💾 Cache hit rate: ${((cacheHits / successful.length) * 100).toFixed(1)}%`);
    console.log(`🔢 Total tokens: ${totalTokens.toLocaleString()}`);
    
    if (failed.length > 0) {
      console.log(`❌ Failed requests: ${failed.length}`);
      const errorCounts = {};
      failed.forEach(f => {
        errorCounts[f.error] = (errorCounts[f.error] || 0) + 1;
      });
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`   ${error}: ${count}`);
      });
    }
    
    // SLO status
    console.log(`🎯 SLO Status: ${p95Compliant ? 'PASS' : 'FAIL'} (P95 target: ${testCase.targetP95}ms)`);
    console.log('');
  }
  
  console.log('🏁 Performance test completed!');
};

// Health check before running tests
const healthCheck = async () => {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    const health = await response.json();
    console.log('✅ Health check passed');
    console.log(`Services: ${JSON.stringify(health.services)}`);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
};

// Main execution
const main = async () => {
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    console.log('Please ensure the DeepSeek router is running and healthy.');
    process.exit(1);
  }
  
  await runPerformanceTest();
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
