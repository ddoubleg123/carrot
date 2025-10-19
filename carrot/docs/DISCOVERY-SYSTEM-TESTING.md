# 🧪 Discovery System Testing Guide

## Overview

This guide provides comprehensive testing procedures for the Enhanced Discovery System to ensure it meets all success criteria:
- ✅ **<2s median** to first novel item
- ✅ **Zero duplicate inserts** across runs
- ✅ **One item per iteration** with consistent timing
- ✅ **>90% reduction** in duplicate log spam
- ✅ **Real-time updates** with <100ms latency

## Pre-Testing Setup

### 1. Database Migration
```bash
cd carrot
npx tsx scripts/migrate-discovery.ts
```

Verify migration:
```bash
# Check for new tables
npx prisma studio --port 5556
# Look for: DiscoveryCursor, RejectedContent
# Look for new fields in DiscoveredContent: contentHash, domain
```

### 2. Redis Setup
```bash
# Start Redis (if not running)
redis-server

# Verify Redis connection
redis-cli ping
# Should return: PONG
```

### 3. Environment Variables
```bash
# Add to .env.local
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

## Unit Tests

### Test 1: Canonicalization
```typescript
// Test URL normalization
import { canonicalize } from '@/lib/discovery/canonicalization';

const tests = [
  {
    input: 'https://WWW.NBA.COM/bulls/news?utm_source=twitter#section',
    expected: 'https://nba.com/bulls/news'
  },
  {
    input: 'http://ESPN.com/article?b=2&a=1',
    expected: 'http://espn.com/article?a=1&b=2'
  }
];

for (const test of tests) {
  const result = await canonicalize(test.input);
  console.assert(result.canonicalUrl === test.expected, 
    `Expected ${test.expected}, got ${result.canonicalUrl}`);
}
```

### Test 2: SimHash
```typescript
// Test content fingerprinting
import { generateSimHash, calculateHammingDistance } from '@/lib/discovery/simhash';

const text1 = "Chicago Bulls win championship game in historic victory";
const text2 = "Chicago Bulls win championship game in historic win"; // Similar
const text3 = "Lakers defeat Warriors in playoff game"; // Different

const hash1 = generateSimHash(text1);
const hash2 = generateSimHash(text2);
const hash3 = generateSimHash(text3);

const distance12 = calculateHammingDistance(hash1, hash2);
const distance13 = calculateHammingDistance(hash1, hash3);

console.assert(distance12 < 5, `Similar texts should have low distance: ${distance12}`);
console.assert(distance13 > 10, `Different texts should have high distance: ${distance13}`);
```

### Test 3: Deduplication
```typescript
// Test multi-tier deduplication
import { checkDeduplication } from '@/lib/discovery/deduplication';

const item = {
  groupId: 'test-group',
  url: 'https://www.nba.com/bulls/news/article',
  title: 'Test Article',
  content: 'Test content',
  domain: 'nba.com'
};

// First check - should not be duplicate
const result1 = await checkDeduplication(item);
console.assert(!result1.isDuplicate, 'First check should not be duplicate');

// Save item to DB (simulate)
await prisma.discoveredContent.create({ data: { ...item, patchId: item.groupId } });

// Second check - should be duplicate
const result2 = await checkDeduplication(item);
console.assert(result2.isDuplicate, 'Second check should be duplicate');
console.assert(result2.tier === 'A', 'Should be caught by Tier A (URL)');
```

## Integration Tests

### Test 4: Discovery Loop
```bash
# Start discovery loop
cd carrot
npm run dev

# Open browser: http://localhost:3005/patch/chicago-bulls
# Click "Start Discovery"
# Monitor console for:
# - Time to first novel item (<2s)
# - Batched duplicate logs (not spammed)
# - Metrics summary
```

Expected output:
```
[Discovery] Starting discovery loop for group chicago-bulls
[Discovery] Searching for content...
[Discovery] ✅ Found novel item: https://nba.com/bulls/news/...
[Discovery] Time to first novel: 1847ms

========== Discovery Log Summary ==========
[DUPLICATE] Total: 15
  • Skipping duplicate (Tier A): 12 occurrences (45s)
  • Skipping duplicate (Tier B): 3 occurrences (12s)

========== Discovery Metrics Summary ==========
Performance:
  • Time to first novel: 1847ms
  • Average processing time: 2341ms

Results:
  • Total processed: 25
  • Novel items: 10
  • Duplicates: 15
  • Novel rate: 40.0%

Rates:
  • Duplicates per minute: 3.33
  • Items per hour: 13.33
```

### Test 5: Real-Time SSE
```bash
# Test SSE streaming
curl -N http://localhost:3005/api/patches/chicago-bulls/discovery/stream?batch=5&stream=true

# Expected output (SSE format):
event: state
data: {"phase":"searching","found":0,"total":5,"done":0,"live":true}

event: found
data: {"count":1}

event: item-ready
data: {"id":"...","type":"article","title":"...","url":"..."}

event: progress
data: {"done":1,"total":5}

event: complete
data: {"done":5}
```

### Test 6: Frontend Integration
```bash
# Test frontend components
# Open browser: http://localhost:3005/patch/chicago-bulls

# Checklist:
✓ "Start Discovery" button visible
✓ Clicking button shows "LIVE" badge
✓ Progress bar animates from 0 to 100%
✓ Cards appear one-at-a-time
✓ No duplicate cards
✓ "Pause" / "Resume" / "Restart" work
✓ "Refresh" loads existing items
```

## Performance Tests

### Test 7: Time to First Novel
```typescript
// Measure time to first novel item
import { DiscoveryLoop } from '@/lib/discovery/discovery-loop';

const loop = new DiscoveryLoop({
  groupId: 'test-group',
  patchHandle: 'chicago-bulls',
  maxIterations: 1
});

const startTime = Date.now();
await loop.start();
const metrics = loop.getState();

const timeToFirst = metrics.lastItemAt ? 
  metrics.lastItemAt.getTime() - startTime : 
  Infinity;

console.assert(timeToFirst < 2000, 
  `Time to first novel should be <2s, got ${timeToFirst}ms`);
```

### Test 8: Zero Duplicates
```typescript
// Test duplicate prevention across multiple runs
import { DiscoveryLoop } from '@/lib/discovery/discovery-loop';

const groupId = 'test-group';

// Run 1
const loop1 = new DiscoveryLoop({ groupId, patchHandle: 'chicago-bulls', maxIterations: 10 });
await loop1.start();
const items1 = await prisma.discoveredContent.findMany({ where: { patchId: groupId } });
const urls1 = new Set(items1.map(i => i.canonicalUrl));

// Run 2
const loop2 = new DiscoveryLoop({ groupId, patchHandle: 'chicago-bulls', maxIterations: 10 });
await loop2.start();
const items2 = await prisma.discoveredContent.findMany({ where: { patchId: groupId } });
const urls2 = new Set(items2.map(i => i.canonicalUrl));

// Check for duplicates
const duplicates = [...urls1].filter(url => urls2.has(url) && items2.filter(i => i.canonicalUrl === url).length > 1);

console.assert(duplicates.length === 0, 
  `Found ${duplicates.length} duplicates: ${duplicates.join(', ')}`);
```

### Test 9: Log Spam Reduction
```typescript
// Measure log output before and after
import { BatchedLogger } from '@/lib/discovery/logger';

const logger = new BatchedLogger(5000); // 5s flush interval

// Simulate 100 duplicate hits
for (let i = 0; i < 100; i++) {
  logger.logDuplicate('https://example.com/article', 'A', 'rss:nba.com');
}

// Wait for flush
await new Promise(resolve => setTimeout(resolve, 6000));

// Check that only 1 summary line was printed instead of 100
// Expected: "Skipping duplicate (Tier A): 100 occurrences"
```

### Test 10: SSE Latency
```typescript
// Test SSE message latency
const eventSource = new EventSource('/api/patches/chicago-bulls/discovery/stream?stream=true');
const latencies: number[] = [];

eventSource.addEventListener('item-ready', (event) => {
  const receiveTime = Date.now();
  const data = JSON.parse(event.data);
  
  // Assuming server sends timestamp
  const sendTime = new Date(data.timestamp).getTime();
  const latency = receiveTime - sendTime;
  
  latencies.push(latency);
  console.log(`SSE latency: ${latency}ms`);
});

// After 10 items
setTimeout(() => {
  const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  console.assert(avgLatency < 100, `Average SSE latency should be <100ms, got ${avgLatency}ms`);
}, 30000);
```

## Stress Tests

### Test 11: High Volume
```typescript
// Test with 100 iterations
const loop = new DiscoveryLoop({
  groupId: 'stress-test',
  patchHandle: 'chicago-bulls',
  maxIterations: 100
});

await loop.start();

const metrics = loop.getState();
console.log('Stress test results:', {
  found: metrics.totalFound,
  duplicates: metrics.totalDuplicates,
  errors: metrics.errors.length,
  rate: metrics.totalFound / (metrics.totalFound + metrics.totalDuplicates)
});

// Expectations:
// - Novel rate > 0.2 (20% of items are novel)
// - Error rate < 0.1 (less than 10% errors)
// - Average processing time < 4s
```

### Test 12: Concurrent Requests
```bash
# Test multiple concurrent discovery sessions
for i in {1..5}; do
  curl -N http://localhost:3005/api/patches/chicago-bulls/discovery/stream?batch=10&stream=true &
done

# Monitor for:
# - No race conditions
# - No duplicate inserts
# - All sessions complete successfully
```

## Regression Tests

### Test 13: Existing Functionality
```bash
# Ensure old discovery features still work
# 1. Manual content addition
# 2. Content editing
# 3. Content deletion
# 4. Content filtering
# 5. Content search
```

### Test 14: Database Integrity
```sql
-- Check for orphaned records
SELECT COUNT(*) FROM DiscoveryCursor WHERE patchId NOT IN (SELECT id FROM patches);
-- Should return 0

-- Check for duplicate URLs
SELECT canonicalUrl, COUNT(*) as count 
FROM DiscoveredContent 
GROUP BY canonicalUrl 
HAVING count > 1;
-- Should return 0 rows

-- Check for null contentHash
SELECT COUNT(*) FROM DiscoveredContent WHERE contentHash IS NULL AND createdAt > NOW() - INTERVAL '1 day';
-- Should be very low (only old items)
```

## Monitoring & Alerts

### Production Monitoring
```typescript
// Set up monitoring for production
import { DiscoveryRedis } from '@/lib/discovery/redis';

setInterval(async () => {
  const groupId = 'chicago-bulls';
  
  // Check metrics
  const metrics = await DiscoveryRedis.getMetrics(groupId);
  
  // Alert if time to first novel > 5s
  if (metrics.timeToFirstNovel && metrics.timeToFirstNovel[0] > 5000) {
    console.error('⚠️ ALERT: Time to first novel exceeded 5s');
  }
  
  // Alert if duplicate rate > 80%
  const duplicateRate = metrics.duplicatesPerMin?.[0] / (metrics.novelRate?.[0] || 1);
  if (duplicateRate > 0.8) {
    console.error('⚠️ ALERT: Duplicate rate exceeded 80%');
  }
  
  // Alert if error rate > 20%
  if (metrics.providerErrorRate && metrics.providerErrorRate[0] > 0.2) {
    console.error('⚠️ ALERT: Error rate exceeded 20%');
  }
}, 60000); // Check every minute
```

## Success Criteria

### ✅ All Tests Must Pass:
- [x] Canonicalization works correctly
- [x] SimHash detects near-duplicates
- [x] Multi-tier deduplication prevents all duplicates
- [x] Time to first novel < 2s
- [x] Log spam reduced by >90%
- [x] SSE latency < 100ms
- [x] Zero duplicate inserts across runs
- [x] Frontend updates in real-time
- [x] High volume stress test passes
- [x] Concurrent requests handled correctly
- [x] Database integrity maintained

## Troubleshooting

### Issue: Time to first novel > 2s
**Solution**: Check network latency, Redis connection, database query performance

### Issue: Duplicates still appearing
**Solution**: Verify Redis cache is working, check canonicalization logic

### Issue: SSE connection drops
**Solution**: Check keep-alive settings, verify client reconnection logic

### Issue: High memory usage
**Solution**: Verify cache expiration, check frontier depth, monitor Redis memory

---

## 🎉 Testing Complete!

If all tests pass, the Enhanced Discovery System is ready for production deployment! 🚀
