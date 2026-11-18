import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { ensureVideoTranscript, videoTranscript } from '@/lib/learn/videoTranscript'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function memberPatch(handle: string, userId: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, createdBy: true }
  })
  if (!patch) return { error: NextResponse.json({ error: 'Group not found' }, { status: 404 }) }
  if (patch.createdBy === userId) return { patch }
  const member = await prisma.patchMember.findUnique({
    where: { patch_user_member_unique: { patchId: patch.id, userId } },
    select: { id: true }
  })
  if (!member) return { error: NextResponse.json({ error: 'Permission denied' }, { status: 403 }) }
  return { patch }
}

function fields(request: Request, body?: { handle?: unknown; topic?: unknown; url?: unknown }) {
  const search = new URL(request.url).searchParams
  const handle = (typeof body?.handle === 'string' ? body.handle : search.get('handle') || '').trim()
  const topic = (typeof body?.topic === 'string' ? body.topic : search.get('topic') || '').trim()
  const url = (typeof body?.url === 'string' ? body.url : search.get('url') || '').trim()
  return { handle, topic, url }
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { handle, topic, url } = fields(request)
  if (!handle || !topic || !url) return NextResponse.json({ error: 'Missing video.' }, { status: 400 })
  const allowed = await memberPatch(handle, session.user.id)
  if (allowed.error) return allowed.error
  const spoken = await videoTranscript(allowed.patch.id, topic, url)
  if (!spoken) return NextResponse.json({ error: 'That video cannot be transcribed.' }, { status: 400 })
  return NextResponse.json(spoken)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const { handle, topic, url } = fields(request, body)
  if (!handle || !topic || !url) return NextResponse.json({ error: 'Missing video.' }, { status: 400 })
  const allowed = await memberPatch(handle, session.user.id)
  if (allowed.error) return allowed.error
  const spoken = await ensureVideoTranscript(allowed.patch.id, topic, url)
  if (!spoken) return NextResponse.json({ error: 'That video cannot be transcribed.' }, { status: 400 })
  return NextResponse.json(spoken)
}
