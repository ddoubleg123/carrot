const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAgents() {
  try {
    console.log('🔍 Checking agents in database...\n');
    
    // Get all agents (including inactive ones)
    const allAgents = await prisma.agent.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`📊 Total agents in database: ${allAgents.length}`);
    
    if (allAgents.length === 0) {
      console.log('❌ No agents found in database');
      console.log('💡 You may need to create some agents first');
      return;
    }

    // Show all agents
    console.log('\n📋 All agents:');
    allAgents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name} (ID: ${agent.id})`);
      console.log(`   - Active: ${agent.isActive}`);
      console.log(`   - Expertise: ${agent.domainExpertise.join(', ')}`);
      console.log(`   - Created: ${agent.createdAt}`);
      console.log('');
    });

    // Get only active agents
    const activeAgents = await prisma.agent.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    console.log(`✅ Active agents: ${activeAgents.length}`);
    
    if (activeAgents.length === 0) {
      console.log('⚠️  No active agents found. All agents are inactive.');
    }

  } catch (error) {
    console.error('❌ Error checking agents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAgents();
