import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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
      const existing = await prisma.discoveredContent.findUnique({
        where: { id: contentId },
        select: { metadata: true }
      });

      if (!existing) {
        return NextResponse.json({ ok: false, error: 'content not found' }, { status: 404 });
      }

      const snippet = polished.length > 240 ? `${polished.slice(0, 240)}…` : polished;
      let metadata = (existing.metadata as any) || {};
      metadata = {
        ...metadata,
        transcriptPreview: snippet,
        transcriptUpdatedAt: new Date().toISOString(),
        transcriptionSource: 'internal/transcribe'
      };

      await prisma.discoveredContent.update({
        where: { id: contentId },
        data: {
          summary: snippet,
          metadata: metadata as Prisma.JsonObject
        }
      });

      // Run audit on polished transcript for better tags/summary, then auto-route
      const audit = await deepseekAudit({ text: polished, kind: 'video' });
      const { score, decision } = relevanceScore({ content: { tags: audit.tags } });
      const normalisedScore = Math.max(0, Math.min(1, score));

      metadata = {
        ...metadata,
        transcriptFull: polished,
        transcriptDecision: decision,
        audit
      };

      await prisma.discoveredContent.update({
        where: { id: contentId },
        data: {
          summary: audit.summaryShort || snippet,
          metadata: metadata as Prisma.JsonObject,
          relevanceScore: normalisedScore,
          qualityScore: audit.qualityScore ?? 0
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
