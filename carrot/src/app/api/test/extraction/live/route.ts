/**
 * Live extraction tracker endpoint
 * Provides real-time updates on extraction progress
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Store active extraction sessions
const activeSessions = new Map<string, {
  events: Array<{ timestamp: number; type: string; data: any }>
  lastEventTime: number
}>()

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get('sessionId') || 'default'
  const since = searchParams.get('since') ? parseInt(searchParams.get('since')!) : 0

  // Get events since timestamp
  const session = activeSessions.get(sessionId)
  if (!session) {
    return NextResponse.json({ events: [], sessionId })
  }

  const events = session.events.filter(e => e.timestamp > since)
  
  return NextResponse.json({
    events,
    sessionId,
    lastEventTime: session.lastEventTime
  })
}

export async function POST(request: NextRequest) {
  const { sessionId, type, data } = await request.json()
  
  const id = sessionId || 'default'
  if (!activeSessions.has(id)) {
    activeSessions.set(id, {
      events: [],
      lastEventTime: Date.now()
    })
  }
  
  const session = activeSessions.get(id)!
  const event = {
    timestamp: Date.now(),
    type,
    data
  }
  
  session.events.push(event)
  session.lastEventTime = event.timestamp
  
  // Keep only last 1000 events
  if (session.events.length > 1000) {
    session.events = session.events.slice(-1000)
  }
  
  return NextResponse.json({ success: true })
}

// Cleanup old sessions (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  for (const [id, session] of activeSessions.entries()) {
    if (session.lastEventTime < oneHourAgo) {
      activeSessions.delete(id)
    }
  }
}, 5 * 60 * 1000) // Run every 5 minutes

