import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { chooseCanonical } from '@/lib/ingest/canonical';
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

    const canonicalUrl = chooseCanonical(url, undefined) || undefined;

    // Optional: locate a patch by handle if provided
    let patchId: string | undefined;
    if (patchHint) {
      const patch = await prisma.patch.findFirst({ where: { handle: patchHint }, select: { id: true } });
      patchId = patch?.id;
    }

    // Create discovered content
    const item = await prisma.discoveredContent.create({
      data: {
        patchId: patchId || (await fallbackFirstPatchId()),
        type,
        title: title || (url ? new URL(url).hostname : 'Untitled'),
        content: '',
        relevanceScore: 5,
        sourceUrl: url,
        // canonicalUrl omitted here to satisfy current Prisma client types
        tags: [],
        status: 'enriching',
      },
    });

    if (type === 'video' && mediaUrl) {
      // Video path: transcribe with Vosk, polish with DeepSeek, then audit+route
      const vosk = await transcribeWithVosk({ audioUrl: mediaUrl });
      if (!vosk.success || !vosk.transcription) {
        // Fall back to URL-only audit if ASR fails
        const fallbackAudit = await deepseekAudit({ text: `${title || ''} ${url || ''}`.trim() || 'video', kind: 'video' });
        const { score, decision } = relevanceScore({ content: { tags: fallbackAudit.tags } });
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: {
            content: fallbackAudit.summaryShort,
            status: decision === 'approved' ? 'approved' : decision === 'queued' ? 'requires_review' : 'rejected',
            relevanceScore: Math.max(1, Math.min(10, Math.round(score * 10))),
          },
        });
      } else {
        const polished = await polishTranscript(vosk.transcription);
        const vidAudit = await deepseekAudit({ text: polished, kind: 'video' });
        const { score, decision } = relevanceScore({ content: { tags: vidAudit.tags } });
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: {
            content: vidAudit.summaryShort,
            status: decision === 'approved' ? 'approved' : decision === 'queued' ? 'requires_review' : 'rejected',
            relevanceScore: Math.max(1, Math.min(10, Math.round(score * 10))),
          },
        });
      }
    } else {
      // Non-video or no mediaUrl: audit title/url text
      const audit = await deepseekAudit({ text: `${title || ''} ${url || ''}`.trim() || 'content', kind: type as any });
      const { score, decision } = relevanceScore({ content: { tags: audit.tags } });
      await prisma.discoveredContent.update({
        where: { id: item.id },
        data: {
          content: audit.summaryShort,
          status: decision === 'approved' ? 'approved' : decision === 'queued' ? 'requires_review' : 'rejected',
          relevanceScore: Math.max(1, Math.min(10, Math.round(score * 10))),
        },
      });
    }

    // Generate hero image automatically if enabled
    if (DISCOVERY_CONFIG.ENABLE_AUTO_IMAGES) {
      try {
        console.log(`[Discovery] Generating hero image for: ${item.title}`);
        
        const heroResult = await generateAIImage({
          title: item.title,
          summary: item.content || '',
          artisticStyle: DISCOVERY_CONFIG.DEFAULT_IMAGE_STYLE,
          enableHiresFix: DISCOVERY_CONFIG.HD_MODE
        });
        
        if (heroResult.success && heroResult.imageUrl) {
          // Upload to Firebase
          const uploadResult = await uploadHeroImage(heroResult.imageUrl, item.id);
          const firebaseUrl = uploadResult.success ? uploadResult.url : null;
          
          // Update with hero image using correct field names per schema
          await prisma.discoveredContent.update({
            where: { id: item.id },
            data: {
              mediaAssets: {
                hero: firebaseUrl,  // ← Correct field name!
                source: 'ai-generated-auto',
                license: 'generated',
                generatedAt: new Date().toISOString(),
                prompt: heroResult.prompt
              }
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
            await prisma.discoveredContent.update({
              where: { id: item.id },
              data: {
                mediaAssets: {
                  hero: fallbackUrl,  // ← Correct field name!
                  source: wikimediaUrl ? 'wikimedia' : 'generated',
                  license: wikimediaUrl ? 'source' : 'generated'
                }
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
      name: 'General',
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
