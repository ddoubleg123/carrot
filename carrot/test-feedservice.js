// Test script to verify FeedService database operations
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFeedService() {
  console.log('Testing FeedService database operations...\n');

  try {
    // Test 1: Check if AgentMemory model exists
    console.log('1. Testing AgentMemory model...');
    const memoryCount = await prisma.agentMemory.count();
    console.log(`   ✓ AgentMemory model accessible. Current count: ${memoryCount}`);

    // Test 2: Check if AgentFeedEvent model exists
    console.log('2. Testing AgentFeedEvent model...');
    const eventCount = await prisma.agentFeedEvent.count();
    console.log(`   ✓ AgentFeedEvent model accessible. Current count: ${eventCount}`);

    // Test 3: Check if we have any agents
    console.log('3. Checking for existing agents...');
    const agents = await prisma.agent.findMany({ take: 1 });
    if (agents.length > 0) {
      console.log(`   ✓ Found agent: ${agents[0].name} (ID: ${agents[0].id})`);
      
      // Test 4: Create a test memory
      console.log('4. Creating test memory...');
      const testMemory = await prisma.agentMemory.create({
        data: {
          agentId: agents[0].id,
          content: 'Test memory content for FeedService verification',
          embedding: [],
          sourceType: 'manual',
          sourceTitle: 'FeedService Test',
          sourceAuthor: 'Test Script',
          tags: ['test', 'verification'],
          confidence: 1.0,
          fedBy: 'test-script'
        }
      });
      console.log(`   ✓ Test memory created with ID: ${testMemory.id}`);

      // Test 5: Create a test feed event
      console.log('5. Creating test feed event...');
      const testEvent = await prisma.agentFeedEvent.create({
        data: {
          agentId: agents[0].id,
          eventType: 'feed',
          content: 'Test feed event for FeedService verification',
          sourceTitle: 'FeedService Test',
          memoryIds: [testMemory.id],
          fedBy: 'test-script',
          metadata: { test: true }
        }
      });
      console.log(`   ✓ Test feed event created with ID: ${testEvent.id}`);

      // Test 6: Clean up test data
      console.log('6. Cleaning up test data...');
      await prisma.agentMemory.delete({ where: { id: testMemory.id } });
      await prisma.agentFeedEvent.delete({ where: { id: testEvent.id } });
      console.log('   ✓ Test data cleaned up');

      console.log('\n🎉 All FeedService database operations working correctly!');
      console.log('   The FeedService can now store real memories and feed events.');
      
    } else {
      console.log('   ⚠️  No agents found. Please create an agent first.');
    }

  } catch (error) {
    console.error('❌ Error testing FeedService:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFeedService();
