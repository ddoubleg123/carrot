/**
 * Discovery System Migration Script
 * 
 * Runs the database migration for the new discovery system
 */

import { migrateDiscoverySchema } from '../src/lib/discovery/migration';

async function main() {
  console.log('🚀 Starting discovery system migration...');
  
  try {
    await migrateDiscoverySchema();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
