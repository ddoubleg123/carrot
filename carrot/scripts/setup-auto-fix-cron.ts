/**
 * Setup Auto-Fix Cron Job
 * 
 * This script can be run periodically (via cron) to automatically
 * detect and fix discovery issues.
 */

import 'dotenv/config'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function runAutoFix() {
  console.log(`[${new Date().toISOString()}] Running auto-fix...`)

  try {
    // Run auto-fix for all patches
    const { stdout, stderr } = await execAsync('npx tsx scripts/auto-fix-discovery-issues.ts')

    if (stdout) console.log(stdout)
    if (stderr) console.error(stderr)

    console.log(`[${new Date().toISOString()}] Auto-fix completed`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Auto-fix failed:`, error)
    process.exit(1)
  }
}

// If run directly, execute auto-fix
if (require.main === module) {
  runAutoFix().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { runAutoFix }

