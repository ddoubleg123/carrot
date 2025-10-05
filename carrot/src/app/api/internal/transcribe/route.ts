import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { transcribeWithVosk } from '@/lib/asr/vosk';
import { polishTranscript, deepseekAudit } from '@/lib/audit/deepseek';
import { relevanceScore } from '@/lib/router/relevance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Internal endpoint: transcribe audio (Vosk) and polish transcript with DeepSeek before saving.
 * Accepts either a Post or a DiscoveredContent video, but only saves polished text.
 *
 * body: { postId?: string, audioUrl?: string, contentId?: string, mediaUrl?: string }
 */
export async function POST(req: Request, context: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const postId = typeof body?.postId === 'string' ? body.postId : undefined;
    const contentId = typeof body?.contentId === 'string' ? body.contentId : undefined;
    const audioUrl = (typeof body?.audioUrl === 'string' ? body.audioUrl : undefined) || (typeof body?.mediaUrl === 'string' ? body.mediaUrl : undefined);

    if (!audioUrl) return NextResponse.json({ ok: false, error: 'audioUrl/mediaUrl required' }, { status: 400 });

    // Transcribe via Vosk
    const vosk = await transcribeWithVosk({ postId, audioUrl });
    if (!vosk.success || !vosk.transcription) {
      return NextResponse.json({ ok: false, error: vosk.error || 'transcription failed' }, { status: 500 });
    }

    // DeepSeek polish (grammar/punctuation) — we only persist the polished text
    const polished = await polishTranscript(vosk.transcription);

    // If targeting a Post, update Post fields
    if (postId) {
      await prisma.post.update({
        where: { id: postId },
        data: {
          transcriptionStatus: 'completed',
          audioTranscription: polished,
        },
      });
      return NextResponse.json({ ok: true, postId, length: polished.length });
    }

    // If targeting external DiscoveredContent (video), store excerpt and route
    if (contentId) {
      const updated = await prisma.discoveredContent.update({
        where: { id: contentId },
        data: {
          content: polished.slice(0, 150) + (polished.length > 150 ? '…' : ''),
          status: 'enriching',
        },
      });

      // Run audit on polished transcript for better tags/summary, then auto-route
      const audit = await deepseekAudit({ text: polished, kind: 'video' });
      const { score, decision } = relevanceScore({ content: { tags: audit.tags } });
      const routedStatus = decision === 'approved' ? 'approved' : decision === 'queued' ? 'requires_review' : 'rejected';

      await prisma.discoveredContent.update({
        where: { id: contentId },
        data: {
          content: audit.summaryShort,
          status: routedStatus,
          relevanceScore: Math.max(1, Math.min(10, Math.round(score * 10))),
        },
      });

      return NextResponse.json({ ok: true, contentId, length: polished.length });
    }

    return NextResponse.json({ ok: false, error: 'Specify postId or contentId' }, { status: 400 });
  } catch (err: any) {
    console.error('internal/transcribe error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'failed' }, { status: 500 });
  }
}
