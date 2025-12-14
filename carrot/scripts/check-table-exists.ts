/**
 * Check if AgentMemoryFeedQueue table exists
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function checkTable() {
  try {
    // Try to query the table
    const count = await (prisma as any).agentMemoryFeedQueue?.count() || 0
    console.log(`✅ AgentMemoryFeedQueue table exists (${count} rows)`)
    return true
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.message?.includes('Unknown table')) {
      console.log('❌ AgentMemoryFeedQueue table does not exist')
      return false
    }
    console.error('Error checking table:', error)
    return false
  }
}

checkTable()
  .then((exists) => {
    process.exit(exists ? 0 : 1)
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect())

