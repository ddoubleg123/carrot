const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function forensicAnalysis() {
  console.log('🔍 COMPREHENSIVE FORENSIC ANALYSIS OF ACCOUNT VULNERABILITY\n');

  try {
    // 1. Get ALL accounts with full details
    console.log('=== STEP 1: COMPLETE ACCOUNT TABLE DUMP ===');
    const allAccounts = await prisma.account.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            isOnboarded: true,
            createdAt: true
          }
        }
      }
    });

    console.log(`📊 Total accounts in database: ${allAccounts.length}\n`);

    allAccounts.forEach((account, index) => {
      console.log(`ACCOUNT ${index + 1}:`);
      console.log(`  - Account ID: ${account.id}`);
      console.log(`  - Provider: ${account.provider}`);
      console.log(`  - Provider Account ID: ${account.providerAccountId}`);
      console.log(`  - User ID: ${account.userId}`);
      console.log(`  - User Email: ${account.user?.email || 'N/A'}`);
      console.log(`  - User Username: ${account.user?.username || 'N/A'}`);
      console.log(`  - Account Created: ${account.createdAt}`);
      console.log(`  - User Created: ${account.user?.createdAt || 'N/A'}`);
      console.log('');
    });

    // 2. Focus on the problematic providerAccountId
    console.log('=== STEP 2: PROBLEMATIC ACCOUNT ANALYSIS ===');
    const problematicAccounts = allAccounts.filter(
      acc => acc.providerAccountId === '104032037834946442063'
    );

    if (problematicAccounts.length === 0) {
      console.log('✅ No accounts found with providerAccountId: 104032037834946442063');
      console.log('🎉 The vulnerability should be fixed!');
    } else {
      console.log(`🚨 FOUND ${problematicAccounts.length} ACCOUNT(S) WITH PROBLEMATIC PROVIDER ID:`);
      
      problematicAccounts.forEach((account, index) => {
        console.log(`\nPROBLEMATIC ACCOUNT ${index + 1}:`);
        console.log(`  - Account ID: ${account.id}`);
        console.log(`  - Provider: ${account.provider}`);
        console.log(`  - Provider Account ID: ${account.providerAccountId}`);
        console.log(`  - Linked to User: ${account.user?.email}`);
        console.log(`  - User ID: ${account.userId}`);
        console.log(`  - This account should NOT exist!`);
      });

      // 3. Attempt immediate deletion with detailed logging
      console.log('\n=== STEP 3: ATTEMPTING IMMEDIATE DELETION ===');
      
      for (const account of problematicAccounts) {
        console.log(`\n🔧 Deleting Account ID: ${account.id}`);
        console.log(`   - Provider Account ID: ${account.providerAccountId}`);
        console.log(`   - Currently linked to: ${account.user?.email}`);
        
        try {
          const deleteResult = await prisma.account.delete({
            where: { id: account.id }
          });
          console.log(`✅ Successfully deleted account: ${deleteResult.id}`);
        } catch (deleteError) {
          console.error(`❌ Failed to delete account ${account.id}:`, deleteError.message);
          console.error(`   Full error:`, deleteError);
        }
      }

      // 4. Verify deletion
      console.log('\n=== STEP 4: POST-DELETION VERIFICATION ===');
      const remainingProblematicAccounts = await prisma.account.findMany({
        where: {
          providerAccountId: '104032037834946442063'
        },
        include: {
          user: true
        }
      });

      if (remainingProblematicAccounts.length === 0) {
        console.log('✅ DELETION SUCCESSFUL - No problematic accounts remain');
      } else {
        console.log(`❌ DELETION FAILED - ${remainingProblematicAccounts.length} problematic accounts still exist`);
        remainingProblematicAccounts.forEach(acc => {
          console.log(`   - Account ID: ${acc.id} still exists`);
        });
      }
    }

    // 5. Final state verification
    console.log('\n=== STEP 5: FINAL DATABASE STATE ===');
    const finalAccounts = await prisma.account.findMany({
      include: {
        user: {
          select: {
            email: true,
            username: true
          }
        }
      }
    });

    console.log(`📊 Final account count: ${finalAccounts.length}`);
    finalAccounts.forEach((account, index) => {
      console.log(`${index + 1}. Provider Account ID: ${account.providerAccountId}`);
      console.log(`   - User: ${account.user?.email} (@${account.user?.username})`);
    });

    console.log('\n🎯 EXPECTED RESULT AFTER FIX:');
    console.log('✅ Only ONE account should remain: providerAccountId 114925503624947485560 → danielgouldman@gmail.com');
    console.log('✅ daniel@gotcarrot.com should create NEW user on next login');

  } catch (error) {
    console.error('❌ FORENSIC ANALYSIS ERROR:', error);
    console.error('Full error details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

forensicAnalysis();
