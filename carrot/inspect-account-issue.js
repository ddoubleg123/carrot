const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function inspectAccountIssue() {
  console.log('🔍 DETAILED ACCOUNT INSPECTION...\n');

  try {
    // Get all accounts with full details
    const accounts = await prisma.account.findMany({
      include: {
        user: true
      }
    });

    console.log(`📊 Total accounts in database: ${accounts.length}\n`);

    accounts.forEach((account, index) => {
      console.log(`=== ACCOUNT ${index + 1} ===`);
      console.log(`Account ID: ${account.id}`);
      console.log(`Provider: ${account.provider}`);
      console.log(`Provider Account ID: ${account.providerAccountId}`);
      console.log(`User ID: ${account.userId}`);
      console.log(`User Email: ${account.user?.email || 'N/A'}`);
      console.log(`User Name: ${account.user?.name || 'N/A'}`);
      console.log(`Created: ${account.createdAt}`);
      console.log('');
    });

    // Check specifically for the problematic providerAccountId
    const problematicAccount = accounts.find(
      acc => acc.providerAccountId === '104032037834946442063'
    );

    if (problematicAccount) {
      console.log('🚨 PROBLEMATIC ACCOUNT STILL EXISTS:');
      console.log(`   - Account ID: ${problematicAccount.id}`);
      console.log(`   - Provider Account ID: ${problematicAccount.providerAccountId}`);
      console.log(`   - Linked to User: ${problematicAccount.user?.email}`);
      console.log(`   - This should have been deleted!`);
      console.log('');
      
      console.log('🔧 ATTEMPTING MANUAL DELETE NOW...');
      
      await prisma.account.delete({
        where: { id: problematicAccount.id }
      });
      
      console.log('✅ Account successfully deleted!');
      
      // Verify deletion
      const remainingAccounts = await prisma.account.findMany({
        include: { user: true }
      });
      
      console.log('\n📋 REMAINING ACCOUNTS AFTER DELETE:');
      remainingAccounts.forEach((account, index) => {
        console.log(`${index + 1}. Provider Account ID: ${account.providerAccountId}`);
        console.log(`   - User Email: ${account.user?.email}`);
      });
      
    } else {
      console.log('✅ Problematic account not found - should be fixed!');
    }

  } catch (error) {
    console.error('❌ Error inspecting accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

inspectAccountIssue();
