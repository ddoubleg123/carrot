#!/usr/bin/env node
/**
 * Verify Playwright installation
 * Checks if Chromium browser is installed and accessible
 */

import { chromium } from 'playwright'
import { existsSync } from 'fs'
import { join } from 'path'

async function verifyPlaywright() {
  console.log('[Playwright Verify] Checking installation...')
  
  try {
    // Check if executable path exists
    const executablePath = chromium.executablePath()
    console.log('[Playwright Verify] Executable path:', executablePath)
    
    if (!executablePath) {
      console.error('[Playwright Verify] ❌ FAILED: Executable path not found')
      console.error('[Playwright Verify] Run: npx playwright install chromium')
      process.exit(1)
    }
    
    // Check if file exists
    if (!existsSync(executablePath)) {
      console.error('[Playwright Verify] ❌ FAILED: Executable file does not exist:', executablePath)
      console.error('[Playwright Verify] Run: npx playwright install chromium')
      process.exit(1)
    }
    
    // Try to launch browser (quick test)
    console.log('[Playwright Verify] Testing browser launch...')
    const browser = await chromium.launch({ headless: true })
    await browser.close()
    
    console.log('[Playwright Verify] ✅ SUCCESS: Playwright is installed and working')
    return true
  } catch (error) {
    console.error('[Playwright Verify] ❌ FAILED:', error.message)
    console.error('[Playwright Verify] Run: npx playwright install --with-deps chromium')
    process.exit(1)
  }
}

verifyPlaywright().catch((error) => {
  console.error('[Playwright Verify] Unexpected error:', error)
  process.exit(1)
})

