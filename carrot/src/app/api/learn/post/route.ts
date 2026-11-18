import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { readXPost } from '@/lib/learn/xPost'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url).searchParams.get('url') || ''
  const post = await readXPost(url).catch(() => null)
  if (!post) return NextResponse.json({ error: 'That post could not be opened.' }, { status: 404 })
  return NextResponse.json({ post })
}
