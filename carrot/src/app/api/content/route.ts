import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { chooseCanonical } from '@/lib/ingest/canonical';
import { canonicalizeUrlFast } from '@/lib/discovery/canonicalize';
import { deepseekAudit } from '@/lib/audit/deepseek';
import { relevanceScore } from '@/lib/router/relevance';
import { transcribeWithVosk } from '@/lib/asr/vosk';
import { polishTranscript } from '@/lib/audit/deepseek';
import { generateAIImage } from '@/lib/media/aiImageGenerator';
import { uploadHeroImage } from '@/lib/media/uploadHeroImage';
import { fetchWikimediaFallback, generateSVGPlaceholder } from '@/lib/media/fallbackImages';
import { DISCOVERY_CONFIG } from '@/config/discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ingestion Gateway
 * Accepts { url?: string, title?: string, type?: 'article'|'video'|'image'|'pdf'|'text', agentId?, patchHint? }
 * Creates a DiscoveredContent row and performs lightweight enrichment inline (mock) for demo.
 */
export async function POST(req: Request, context: { params: Promise<{}> }) {
  try {
    const body = await req.json();
    const url = typeof body?.url === 'string' ? body.url : undefined;
    const title = typeof body?.title === 'string' ? body.title : undefined;
    const type = (['article','video','image','pdf','text'] as const).includes(body?.type) ? body.type : 'article';
    const patchHint = typeof body?.patchHint === 'string' ? body.patchHint : undefined;
    const mediaUrl = typeof body?.mediaUrl === 'string' ? body.mediaUrl : undefined;
    const submittedBy = typeof body?.submittedBy === 'string' ? body.submittedBy : 'anonymous';
    const submittedNotes = typeof body?.notes === 'string' ? body.notes : '';
    const submittedTags = Array.isArray(body?.tags) ? body.tags.filter((tag: unknown) => typeof tag === 'string') : [];

    const canonicalUrl = canonicalizeUrlFast(chooseCanonical(url, undefined) || url || `generated://${randomUUID()}`);

    // Optional: locate a patch by handle if provided
    let patchId: string | undefined;
    if (patchHint) {
      const patch = await prisma.patch.findFirst({ where: { handle: patchHint }, select: { id: true } });
      patchId = patch?.id;
    }

    // Create discovered content
    let item;
    let latestSummary = '';
    let latestWhyItMatters: string | null = null;
    let latestQuality = 0;
    let latestRelevance = 0.5;
    try {
      item = await prisma.discoveredContent.create({
        data: {
          patchId: patchId || (await fallbackFirstPatchId()),
          title: title || (url ? new URL(url).hostname : 'Untitled'),
          summary: '',
          whyItMatters: null,
          relevanceScore: 0.5,
          qualityScore: 0,
          sourceUrl: url,
          canonicalUrl,
          domain: (() => {
            try {
              return url ? new URL(url).hostname.replace(/^www\./, '') : 'manual';
            } catch {
              return 'manual';
            }
          })(),
          metadata: {
            source: 'manual',
            notes: submittedNotes,
            tags: submittedTags,
            addedBy: submittedBy,
            addedAt: new Date().toISOString(),
            urlSlug: `${(title || canonicalUrl || 'content').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 8)}`
          } as Prisma.JsonObject,
          category: type || 'article',
          facts: Prisma.JsonNull,
          quotes: Prisma.JsonNull,
          provenance: Prisma.JsonNull,
          hero: Prisma.JsonNull
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { ok: false, reason: 'duplicate', canonicalUrl },
          { status: 200 }
        );
      }
      throw error;
    }

    // Normalise metadata helper
    const baseMetadata: Prisma.JsonObject = (() => {
      if (item?.metadata && typeof item.metadata === 'object' && item.metadata !== null) {
        return { ...(item.metadata as Prisma.JsonObject) };
      }
      return {};
    })();

    const normaliseScore = (score: number) => Math.max(0, Math.min(1, score));

    if (type === 'video' && mediaUrl) {
      // Video path: transcribe with Vosk, polish with DeepSeek, then audit+route
      const vosk = await transcribeWithVosk({ audioUrl: mediaUrl });
      if (!vosk.success || !vosk.transcription) {
        // Fall back to URL-only audit if ASR fails
        const fallbackAudit = await deepseekAudit({ text: `${title || ''} ${url || ''}`.trim() || 'video', kind: 'video' });
        const { score, decision } = relevanceScore({ content: { tags: fallbackAudit.tags } });
        latestSummary = fallbackAudit.summaryShort || '';
        latestWhyItMatters = null;
        latestQuality = fallbackAudit.qualityScore ?? 0;
        latestRelevance = normaliseScore(score);
        baseMetadata.audit = fallbackAudit;
        baseMetadata.decision = decision;
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: {
            summary: latestSummary,
            whyItMatters: latestWhyItMatters,
            relevanceScore: latestRelevance,
            qualityScore: latestQuality,
            metadata: baseMetadata
          }
        });
      } else {
        const polished = await polishTranscript(vosk.transcription);
        const vidAudit = await deepseekAudit({ text: polished, kind: 'video' });
        const { score, decision } = relevanceScore({ content: { tags: vidAudit.tags } });
        latestSummary = vidAudit.summaryShort || '';
        latestWhyItMatters = null;
        latestQuality = vidAudit.qualityScore ?? 0;
        latestRelevance = normaliseScore(score);
        baseMetadata.audit = vidAudit;
        baseMetadata.decision = decision;
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: {
            summary: latestSummary,
            whyItMatters: latestWhyItMatters,
            relevanceScore: latestRelevance,
            qualityScore: latestQuality,
            metadata: baseMetadata
          }
        });
      }
    } else {
      // Non-video or no mediaUrl: audit title/url text
      const audit = await deepseekAudit({ text: `${title || ''} ${url || ''}`.trim() || 'content', kind: type as any });
      const { score, decision } = relevanceScore({ content: { tags: audit.tags } });
      latestSummary = audit.summaryShort || '';
      latestWhyItMatters = null;
      latestQuality = audit.qualityScore ?? 0;
      latestRelevance = normaliseScore(score);
      baseMetadata.audit = audit;
      baseMetadata.decision = decision;
      await prisma.discoveredContent.update({
        where: { id: item.id },
        data: {
          summary: latestSummary,
          whyItMatters: latestWhyItMatters,
          relevanceScore: latestRelevance,
          qualityScore: latestQuality,
          metadata: baseMetadata
        }
      });
    }

    // Generate hero image automatically if enabled
    if (DISCOVERY_CONFIG.ENABLE_AUTO_IMAGES) {
      try {
        console.log(`[Discovery] Generating hero image for: ${item.title}`);
        
        const heroResult = await generateAIImage({
          title: item.title,
          summary: latestSummary || '',
          artisticStyle: DISCOVERY_CONFIG.DEFAULT_IMAGE_STYLE,
          enableHiresFix: DISCOVERY_CONFIG.HD_MODE
        });
        
        if (heroResult.success && heroResult.imageUrl) {
          // Upload to Firebase
          const firebaseUrl = await uploadHeroImage({
            base64Image: heroResult.imageUrl,
            itemId: item.id,
            storageType: 'discovered'
          });
          
          const heroPayload: Prisma.JsonObject = {
            url: firebaseUrl,
            source: 'ai-generated-auto',
            license: 'generated',
            generatedAt: new Date().toISOString(),
            prompt: heroResult.prompt,
            origin: 'content-ingest'
          };
          await prisma.discoveredContent.update({
            where: { id: item.id },
            data: {
              hero: heroPayload
            }
          });
          
          console.log(`[Discovery] ✅ Generated hero image for: ${item.title}`);
        } else {
          // Try fallback images
          console.log(`[Discovery] AI generation failed, trying fallbacks for: ${item.title}`);
          // Try Wikimedia first
          const wikimediaUrl = await fetchWikimediaFallback(item.title);
          let fallbackUrl = wikimediaUrl;
          
          // If no Wikimedia image, use SVG placeholder
          if (!fallbackUrl) {
            fallbackUrl = generateSVGPlaceholder(item.title);
          }
          
          if (fallbackUrl) {
            const fallbackHero: Prisma.JsonObject = {
              url: fallbackUrl,
              source: wikimediaUrl ? 'wikimedia' : 'generated',
              license: wikimediaUrl ? 'source' : 'generated',
              generatedAt: new Date().toISOString(),
              origin: wikimediaUrl ? 'wikimedia' : 'placeholder'
            };
            await prisma.discoveredContent.update({
              where: { id: item.id },
              data: {
                hero: fallbackHero
              }
            });
            console.log(`[Discovery] ⚠️  Used fallback image (${wikimediaUrl ? 'wikimedia' : 'generated'}) for: ${item.title}`);
          }
        }
      } catch (imageError) {
        console.error(`[Discovery] Image generation error:`, imageError);
        // Continue without image - don't fail the whole discovery
      }
    }

    return NextResponse.json({ ok: true, id: item.id });
  } catch (err: any) {
    console.error('Ingest error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'ingest failed' }, { status: 500 });
  }
}

async function fallbackFirstPatchId() {
  const any = await prisma.patch.findFirst({ select: { id: true } });
  if (any?.id) return any.id;
  // create a seed patch if none exists
  const created = await prisma.patch.create({
    data: {
      handle: 'general',
      title: 'General',
      description: 'General Patch',
      tags: [],
      createdBy: (await ensureSeedUser()).id,
    },
    select: { id: true },
  });
  return created.id;
}

async function ensureSeedUser() {
  const u = await prisma.user.findFirst({});
  if (u) return u;
  return prisma.user.create({ data: { email: `seed-${Date.now()}@carrot.local`, name: 'Seed User' } });
}
