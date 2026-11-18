/**
 * Auto-Fix Discovery Issues API Endpoint
 * 
 * POST /api/discovery/auto-fix
 * 
 * Automatically detects and fixes discovery issues
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { patchHandle, detectOnly, verbose } = body

    // Build command
    const args = []
    if (patchHandle) args.push(patchHandle)
    if (detectOnly) args.push('--detect-only')
    if (verbose) args.push('--verbose')

    const command = `npx tsx scripts/auto-fix-discovery-issues.ts ${args.join(' ')}`

    // Run auto-fix script
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 300000, // 5 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      })

      return NextResponse.json({
        success: true,
        output: stdout,
        errors: stderr || null,
        command
      })
    } catch (error: any) {
      // Exec error might still have output
      return NextResponse.json({
        success: false,
        error: error.message,
        output: error.stdout || '',
        errors: error.stderr || '',
        command
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[Auto-Fix API] Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const patchHandle = url.searchParams.get('patch')
    const detectOnly = url.searchParams.get('detect-only') === 'true'

    // Build command (detect only)
    const args = ['--detect-only']
    if (patchHandle) args.unshift(patchHandle)

    const command = `npx tsx scripts/auto-fix-discovery-issues.ts ${args.join(' ')}`

    // Run detection only
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 60000, // 1 minute timeout
        maxBuffer: 5 * 1024 * 1024 // 5MB buffer
      })

      return NextResponse.json({
        success: true,
        output: stdout,
        errors: stderr || null,
        command
      })
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: error.message,
        output: error.stdout || '',
        errors: error.stderr || '',
        command
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[Auto-Fix API] Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    )
  }
}

