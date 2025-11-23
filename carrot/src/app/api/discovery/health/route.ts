import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRedisClient } from '@/lib/redis/discovery'

/**
 * GET /api/discovery/health
 * Health check for discovery pipeline components
 */
export const runtime = 'nodejs'

export async function GET() {
  const health: {
    redis: boolean
    db: boolean
    timestamp: string
  } = {
    redis: false,
    db: false,
    timestamp: new Date().toISOString()
  }

  // Check Redis
  try {
    const redis = await getRedisClient()
    await redis.ping()
    health.redis = true
  } catch (error) {
    console.error('[Discovery Health] Redis check failed:', error)
  }

  // Check DB
  try {
    await prisma.$queryRaw`SELECT 1`
    health.db = true
  } catch (error) {
    console.error('[Discovery Health] DB check failed:', error)
  }

  const allHealthy = health.redis && health.db

  return NextResponse.json(health, {
    status: allHealthy ? 200 : 503
  })
}

