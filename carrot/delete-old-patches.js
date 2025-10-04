#!/usr/bin/env node

/**
 * Delete old patches except for Israel and history
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteOldPatches() {
  try {
    console.log('🔍 Fetching all patches...');
    
    // Get all patches
    const patches = await prisma.patch.findMany({
      select: {
        id: true,
        handle: true,
        name: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 Found ${patches.length} patches:`);
    patches.forEach((patch, index) => {
      console.log(`${index + 1}. ${patch.name} (${patch.handle}) - ${patch.createdAt.toISOString()}`);
    });

    // Keep only the most recent Israel patch and history patch
    const israelPatches = patches.filter(patch => 
      patch.handle.toLowerCase().includes('israel')
    );
    const historyPatches = patches.filter(patch => 
      patch.handle.toLowerCase().includes('history')
    );
    
    // Keep the most recent Israel patch and all history patches
    const patchesToKeep = [
      ...(israelPatches.length > 0 ? [israelPatches[0]] : []), // Most recent Israel
      ...historyPatches // All history patches
    ];

    const patchesToDelete = patches.filter(patch => 
      !patchesToKeep.some(keep => keep.id === patch.id)
    );

    console.log(`\n✅ Keeping ${patchesToKeep.length} patches:`);
    patchesToKeep.forEach(patch => {
      console.log(`  - ${patch.name} (${patch.handle})`);
    });

    console.log(`\n🗑️ Deleting ${patchesToDelete.length} patches:`);
    patchesToDelete.forEach(patch => {
      console.log(`  - ${patch.name} (${patch.handle})`);
    });

    if (patchesToDelete.length === 0) {
      console.log('✅ No patches to delete!');
      return;
    }

    // Confirm deletion
    console.log('\n⚠️  This will permanently delete the patches listed above.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete patches
    for (const patch of patchesToDelete) {
      try {
        console.log(`🗑️ Deleting ${patch.name} (${patch.handle})...`);
        await prisma.patch.delete({
          where: { id: patch.id }
        });
        console.log(`✅ Deleted ${patch.name}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${patch.name}:`, error.message);
      }
    }

    console.log('\n🎉 Patch cleanup completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteOldPatches();
