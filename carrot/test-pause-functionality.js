const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPauseFunctionality() {
  try {
    console.log('🔍 Testing pause functionality...');
    
    // Get all training plans
    const plans = await prisma.trainingPlan.findMany({
      where: {
        status: {
          in: ['running', 'pending']
        }
      },
      select: {
        id: true,
        agentId: true,
        status: true,
        options: true,
        totals: true
      }
    });
    
    console.log(`📋 Found ${plans.length} active training plans:`);
    plans.forEach(plan => {
      console.log(`  - Plan ${plan.id} (Agent: ${plan.agentId})`);
      console.log(`    Status: ${plan.status}`);
      console.log(`    Pause Discovery: ${plan.options?.pauseDiscovery || false}`);
      console.log(`    Totals: ${JSON.stringify(plan.totals)}`);
    });
    
    if (plans.length === 0) {
      console.log('❌ No active training plans found');
      return;
    }
    
    // Test pausing the first plan
    const testPlan = plans[0];
    console.log(`\n🔄 Testing pause for plan ${testPlan.id}...`);
    
    // Parse the existing options (it's stored as a JSON string)
    let currentOptions;
    try {
      currentOptions = JSON.parse(testPlan.options || '{}');
    } catch (e) {
      console.log('❌ Failed to parse options JSON:', e.message);
      return;
    }
    
    console.log('   Current options:', currentOptions);
    console.log('   Current pauseDiscovery:', currentOptions.pauseDiscovery);
    
    // Update the plan to pause discovery
    const updatedOptions = { ...currentOptions, pauseDiscovery: true };
    const updatedPlan = await prisma.trainingPlan.update({
      where: { id: testPlan.id },
      data: {
        options: JSON.stringify(updatedOptions)
      }
    });
    
    console.log('✅ Successfully paused discovery for plan:', updatedPlan.id);
    console.log('   Updated options:', updatedPlan.options);
    
    // Parse and verify the updated options
    const parsedUpdatedOptions = JSON.parse(updatedPlan.options);
    console.log('   Verified pauseDiscovery:', parsedUpdatedOptions.pauseDiscovery);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Resume discovery
    console.log(`\n🔄 Testing resume for plan ${testPlan.id}...`);
    
    const resumedOptions = { ...parsedUpdatedOptions, pauseDiscovery: false };
    const resumedPlan = await prisma.trainingPlan.update({
      where: { id: testPlan.id },
      data: {
        options: JSON.stringify(resumedOptions)
      }
    });
    
    console.log('✅ Successfully resumed discovery for plan:', resumedPlan.id);
    console.log('   Resumed options:', resumedPlan.options);
    
    // Parse and verify the resumed options
    const parsedResumedOptions = JSON.parse(resumedPlan.options);
    console.log('   Verified pauseDiscovery:', parsedResumedOptions.pauseDiscovery);
    
    console.log('\n🎉 Pause functionality test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing pause functionality:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPauseFunctionality();
