const { PrismaClient } = require('@prisma/client');

async function fixAccountMixing() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== FIXING ACCOUNT MIXING VULNERABILITY ===');
    
    // Step 1: Find the problematic account link
    const problematicAccount = await prisma.account.findFirst({
      where: {
        providerAccountId: '104032037834946442063',
        provider: 'google'
      },
      include: {
        user: true
      }
    });
    
    console.log('Found problematic account:', JSON.stringify(problematicAccount, null, 2));
    
    if (problematicAccount) {
      console.log(`\n🚨 CRITICAL: Google account 104032037834946442063 is linked to user ${problematicAccount.user.email}`);
      console.log('This Google account should belong to daniel@gotcarrot.com, not danielgouldman@gmail.com');
      
      // Step 2: Delete the incorrect account link
      console.log('\n🔧 REMOVING INCORRECT ACCOUNT LINK...');
      const deleteResult = await prisma.account.delete({
        where: {
          id: problematicAccount.id
        }
      });
      
      console.log('✅ Successfully deleted incorrect account link:', deleteResult.id);
      
      // Step 3: Verify the fix
      const verifyAccount = await prisma.account.findFirst({
        where: {
          providerAccountId: '104032037834946442063',
          provider: 'google'
        }
      });
      
      if (!verifyAccount) {
        console.log('✅ VERIFICATION PASSED: No account link found for Google account 104032037834946442063');
        console.log('✅ VULNERABILITY FIXED: daniel@gotcarrot.com will now create a separate user account');
      } else {
        console.log('❌ VERIFICATION FAILED: Account link still exists');
      }
    } else {
      console.log('No problematic account found - may already be fixed');
    }
    
    // Step 4: Show final state
    console.log('\n=== FINAL ACCOUNT STATE ===');
    const danielGmailAccounts = await prisma.account.findMany({
      where: {
        user: {
          email: 'danielgouldman@gmail.com'
        }
      }
    });
    
    const danielCarrotAccounts = await prisma.account.findMany({
      where: {
        user: {
          email: 'daniel@gotcarrot.com'
        }
      }
    });
    
    console.log('danielgouldman@gmail.com accounts:', danielGmailAccounts.length);
    console.log('daniel@gotcarrot.com accounts:', danielCarrotAccounts.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAccountMixing();
