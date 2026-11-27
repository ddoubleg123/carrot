import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { beginDm, beginEmail, currentUser, listThreads } from '@/lib/mail/box'

export async function GET() {
  const session = await auth()
  const user = await currentUser(session?.user?.email)
  if (!user) return NextResponse.json({ error: 'Sign in to use messages.' }, { status: 401 })
  const box = await listThreads(user)
  return NextResponse.json(box)
}

export async function POST(request: Request) {
  const session = await auth()
  const user = await currentUser(session?.user?.email)
  if (!user) return NextResponse.json({ error: 'Sign in to use messages.' }, { status: 401 })
  const body = await request.json().catch(() => null) as { kind?: string; to?: string; subject?: string } | null
  const to = body?.to || ''
  const result = body?.kind === 'email' || to.includes('@')
    ? await beginEmail(user.id, to, body?.subject || '')
    : await beginDm(user.id, to)
  if ('error' in result && result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
