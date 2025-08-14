const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixAccountIsolation() {
  console.log('🔧 FIXING ACCOUNT ISOLATION VULNERABILITY...\n');

  try {
    // Get all accounts for the affected user
    const user = await prisma.user.findUnique({
      where: { email: 'danielgouldman@gmail.com' },
      include: {
        accounts: true
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`👤 User: ${user.email} (${user.name})`);
    console.log(`📱 Linked accounts: ${user.accounts.length}\n`);

    // Show all linked accounts
    user.accounts.forEach((account, index) => {
      console.log(`Account ${index + 1}:`);
      console.log(`   - Provider: ${account.provider}`);
      console.log(`   - Provider Account ID: ${account.providerAccountId}`);
      console.log(`   - Created: ${account.createdAt}`);
      console.log('');
    });

    // Find the problematic account (the one that should be for daniel@gotcarrot.com)
    const problematicAccount = user.accounts.find(
      acc => acc.providerAccountId === '104032037834946442063'
    );

    if (!problematicAccount) {
      console.log('❌ Problematic account not found');
      return;
    }

    console.log('🚨 PROBLEMATIC ACCOUNT FOUND:');
    console.log(`   - This providerAccountId (${problematicAccount.providerAccountId}) should belong to daniel@gotcarrot.com`);
    console.log(`   - But it's currently linked to ${user.email}`);
    console.log('');

    // OPTION 1: Delete the problematic account link
    // This will force daniel@gotcarrot.com to create a new user account on next login
    console.log('🔧 FIXING: Unlinking problematic account...');
    
    await prisma.account.delete({
      where: { id: problematicAccount.id }
    });

    console.log('✅ Account unlinked successfully!');
    console.log('');
    console.log('📋 RESULT:');
    console.log('   - danielgouldman@gmail.com will keep its original account');
    console.log('   - daniel@gotcarrot.com will create a NEW separate user account on next login');
    console.log('   - Account isolation is now restored!');

  } catch (error) {
    console.error('❌ Error fixing account isolation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAccountIsolation();
