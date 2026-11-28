import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { peerStanding } from '@/lib/peerStanding'

export async function GET() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  try {
    const standing = await peerStanding(user.id)
    return NextResponse.json(standing)
  } catch (error) {
    console.error('Error comparing carrot standing', error instanceof Error ? error.message : 'failed')
    return NextResponse.json({ ahead: null, peers: 0 })
  }
}
