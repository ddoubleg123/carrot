const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyFixSafety() {
  console.log('🔍 VERIFYING FIX SAFETY - NO CHANGES WILL BE MADE\n');

  try {
    // Get the current state
    const user = await prisma.user.findUnique({
      where: { email: 'danielgouldman@gmail.com' },
      include: {
        accounts: true,
        posts: true
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('📊 CURRENT STATE:');
    console.log(`👤 User: ${user.email} (ID: ${user.id})`);
    console.log(`📱 Linked accounts: ${user.accounts.length}`);
    console.log(`📝 Posts created: ${user.posts.length}`);
    console.log('');

    // Show accounts
    console.log('🔗 LINKED ACCOUNTS:');
    user.accounts.forEach((account, index) => {
      console.log(`${index + 1}. Provider Account ID: ${account.providerAccountId}`);
      console.log(`   - Provider: ${account.provider}`);
      console.log(`   - Account ID: ${account.id}`);
      console.log(`   - Created: ${account.createdAt}`);
      console.log('');
    });

    // Identify which account to remove
    const problematicAccount = user.accounts.find(
      acc => acc.providerAccountId === '104032037834946442063'
    );

    const keepAccount = user.accounts.find(
      acc => acc.providerAccountId === '114925503624947485560'
    );

    console.log('🎯 PLANNED ACTION:');
    if (problematicAccount) {
      console.log(`❌ REMOVE: Account ID ${problematicAccount.id} (providerAccountId: ${problematicAccount.providerAccountId})`);
      console.log('   - This will unlink daniel@gotcarrot.com from this user');
      console.log('   - daniel@gotcarrot.com will create a NEW user account on next login');
    }
    
    if (keepAccount) {
      console.log(`✅ KEEP: Account ID ${keepAccount.id} (providerAccountId: ${keepAccount.providerAccountId})`);
      console.log('   - danielgouldman@gmail.com will continue to work normally');
    }

    console.log('\n📋 EXPECTED RESULT AFTER FIX:');
    console.log('✅ danielgouldman@gmail.com → keeps existing @daniel profile & posts');
    console.log('✅ daniel@gotcarrot.com → will create NEW separate user account');
    console.log('✅ Complete account isolation restored');
    console.log('✅ No data loss - all posts remain with original user');

    console.log('\n⚠️  IMPORTANT: This fix is IRREVERSIBLE');
    console.log('💡 After fix, daniel@gotcarrot.com will go through onboarding as a new user');

  } catch (error) {
    console.error('❌ Error verifying fix safety:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyFixSafety();
