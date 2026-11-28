import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { currentUser, readThread, speak } from '@/lib/mail/box'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const user = await currentUser(session?.user?.email)
  if (!user) return NextResponse.json({ error: 'Sign in to use messages.' }, { status: 401 })
  const { id } = await context.params
  const thread = await readThread(user.id, id)
  if (!thread) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  return NextResponse.json(thread)
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const user = await currentUser(session?.user?.email)
  if (!user) return NextResponse.json({ error: 'Sign in to use messages.' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json().catch(() => null) as { text?: string; image?: string; html?: string } | null
  const result = await speak(user.id, id, body?.text || '', body?.image, body?.html)
  if ('error' in result && result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
