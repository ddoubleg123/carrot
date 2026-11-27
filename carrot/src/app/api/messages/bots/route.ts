import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { currentUser } from '@/lib/mail/box'
import { botDirectory } from '@/lib/mail/botReply'

export async function GET() {
  const session = await auth()
  const user = await currentUser(session?.user?.email)
  if (!user) return NextResponse.json({ error: 'Sign in to use messages.' }, { status: 401 })
  return NextResponse.json({ bots: botDirectory() })
}
