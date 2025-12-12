console.log('--- TOP OF PATCHES ROUTE FILE LOADED ---');
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { OPEN_EVIDENCE_V2 } from '@/lib/flags';
import { generateGuideSnapshot } from '@/lib/discovery/planner';
import { initializeWikipediaMonitoring } from '@/lib/discovery/wikipediaMonitoring';
import { AgentRegistry } from '@/lib/ai-agents/agentRegistry';
import { generateAgentAvatar, generateFallbackAvatar } from '@/lib/ai-agents/agentAvatarGenerator';

function sanitizeEntity(rawEntity: any) {
  if (!rawEntity || typeof rawEntity !== 'object') return undefined;
  const name = typeof rawEntity.name === 'string' ? rawEntity.name.trim() : undefined;
  const aliases = Array.isArray(rawEntity.aliases)
    ? rawEntity.aliases
        .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value: string) => value.trim())
    : undefined;
  const type = typeof rawEntity.type === 'string' ? rawEntity.type.trim() : undefined;
  const entity: Record<string, unknown> = {};
  if (name) entity.name = name;
  if (aliases && aliases.length) entity.aliases = aliases;
  if (type) entity.type = type;
  return Object.keys(entity).length ? entity : undefined;
}

export async function POST(request: Request, context: { params: Promise<{}> }) {
  console.error('[CRITICAL] ===== PATCHES POST ENDPOINT CALLED =====');
  console.error('[CRITICAL] Request URL:', request.url);
  console.error('[CRITICAL] Request method:', request.method);
  console.error('[CRITICAL] Timestamp:', new Date().toISOString());
  console.error('[CRITICAL] Request headers:', Object.fromEntries(request.headers.entries()));
  console.error('[CRITICAL] Request body available:', request.body ? 'Yes' : 'No');

  try {
    // Check authentication
    console.log('[API] Checking authentication...');
    const session: any = await auth();
    console.log('[API] Session:', session ? 'Found' : 'Not found');
    if (!session?.user?.id) {
      console.log('[API] Authentication failed - no session or user ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('[API] Authentication successful for user:', session.user.id);

    // Parse request body
    let body;
    try {
      const rawBody = await request.text();
      console.log('[API] Raw request body:', rawBody);
      
      if (!rawBody || rawBody.trim() === '') {
        console.error('[API] Empty request body');
        return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
      }
      
      body = JSON.parse(rawBody);
      console.log('[API] Parsed request body:', JSON.stringify(body, null, 2));
    } catch (error) {
      console.error('[API] Error parsing request body:', error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    // Extract and validate fields
    const titleInput = typeof body?.title === 'string' ? body.title : body?.name;
    const description = body?.description || '';
    const tags = Array.isArray(body?.tags) ? body.tags : [];
    const categories = Array.isArray(body?.categories) ? body.categories : [];
    const rawEntity = sanitizeEntity(body?.entity);

    console.log('[API] Extracted fields:', { title: titleInput, description, tags, categories });
    console.log('[API] Field types:', { 
      titleType: typeof titleInput, 
      descriptionType: typeof description, 
      tagsType: typeof tags, 
      categoriesType: typeof categories 
    });

    // Validate required fields
    if (!titleInput || typeof titleInput !== 'string' || !titleInput.trim()) {
      console.log('[API] Validation failed: title is missing, not a string, or empty');
      console.log('[API] Title value:', titleInput);
      console.log('[API] Title type:', typeof titleInput);
      return NextResponse.json({ error: 'Group title is required' }, { status: 400 });
    }
    const title = titleInput.trim();

    // Generate a unique handle from the name
    const baseHandle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();

    // Ensure handle is unique
    let handle = baseHandle;
    let counter = 1;
    while (true) {
      const existing = await prisma.patch.findUnique({
        where: { handle }
      });
      if (!existing) break;
      handle = `${baseHandle}-${counter}`;
      counter++;
    }

    // Create the patch
    const patch = await prisma.patch.create({
      data: {
        handle,
        title,
        description: String(description || '').trim(),
        createdBy: session.user.id,
        entity: rawEntity ? (rawEntity as unknown as Prisma.JsonObject) : undefined,
        tags: tags.filter((tag: any) => typeof tag === 'string'), // Ensure all tags are strings
        theme: 'light' // Default theme
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true
          }
        },
        _count: {
          select: {
            members: true,
            posts: true,
            events: true,
            sources: true
          }
        }
      }
    });

    // Add the creator as the first member with admin role
    await prisma.patchMember.create({
      data: {
        patchId: patch.id,
        userId: session.user.id,
        role: 'admin'
      }
    });

    let guide: any = null;
    if (OPEN_EVIDENCE_V2) {
      try {
        const topic = (rawEntity?.name as string | undefined)?.trim() || title;
        const aliases = rawEntity?.aliases
          ? (rawEntity.aliases as string[]).filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
          : tags.filter((tag: any): tag is string => typeof tag === 'string' && tag.trim().length > 0);
        guide = await generateGuideSnapshot(topic, aliases);
        await prisma.patch.update({
          where: { id: patch.id },
          data: {
            guide: guide as unknown as Prisma.JsonObject
          }
        });
      } catch (guideError) {
        console.error('[API] Failed to generate discovery guide during patch creation', guideError);
      }
    }

    // Initialize Wikipedia monitoring (background task - don't block response)
    try {
      const pageName = (rawEntity?.name as string | undefined)?.trim() || title;
      const searchTerms = rawEntity?.aliases
        ? (rawEntity.aliases as string[]).filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
        : tags.filter((tag: any): tag is string => typeof tag === 'string' && tag.trim().length > 0);
      
      console.log('[API] Initializing Wikipedia monitoring:', { patchId: patch.id, pageName, searchTerms });
      
      // Run in background - don't await to avoid blocking response
      initializeWikipediaMonitoring(patch.id, pageName, searchTerms)
        .then((result) => {
          console.log('[API] Wikipedia monitoring initialized:', result);
        })
        .catch((error) => {
          console.error('[API] Failed to initialize Wikipedia monitoring:', error);
          // Log to structured logger if available
          try {
            const { structuredLog } = require('@/lib/discovery/structuredLogger');
            structuredLog('wikipedia_monitoring_init_error', {
              patchId: patch.id,
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString()
            });
          } catch {
            // Non-fatal
          }
        });
    } catch (wikiError) {
      console.error('[API] Error setting up Wikipedia monitoring:', wikiError);
      // Non-fatal - continue with patch creation
    }

    // Auto-create AI agent for this patch (background task - don't block response)
    try {
      console.log('[API] Creating AI agent for new patch:', { patchId: patch.id, title: patch.title });
      
      // Run in background - don't await to avoid blocking response
      (async () => {
        try {
          // Generate avatar for the agent
          const avatarResult = await generateAgentAvatar({
            patchTitle: patch.title,
            patchDescription: patch.description,
            tags: patch.tags as string[] || []
          });
          
          // Use generated avatar or fallback
          const avatarUrl = avatarResult.success && avatarResult.avatarUrl 
            ? avatarResult.avatarUrl 
            : generateFallbackAvatar(patch.title);
          
          // Create the agent
          const agent = await AgentRegistry.createAgent({
            name: `${patch.title} Specialist`,
            persona: `I am an AI agent specialized in ${patch.title}. ${patch.description || 'I learn everything about this topic by reading all relevant content, data, and information that is scanned and stored. I continuously monitor and analyze new information to build comprehensive knowledge about this subject.'}`,
            domainExpertise: (patch.tags as string[]) || [],
            associatedPatches: [patch.handle],
            metadata: {
              avatar: avatarUrl,
              role: 'patch-specialist',
              expertise: (patch.tags as string[]) || [],
              patchId: patch.id,
              patchHandle: patch.handle,
              createdAt: new Date().toISOString()
            },
            knowledgeProfile: {
              expertise: patch.title,
              strengths: ['Content analysis', 'Information synthesis', 'Topic monitoring'],
              limitations: ['Requires content to be scanned and stored']
            }
          });
          
          console.log('[API] ✅ Successfully created AI agent:', { agentId: agent.id, agentName: agent.name });
          
          // Set up content feeding for the newly created agent
          // The agent will automatically receive content as it's discovered and stored
          // via the feedCarrotContentToAgents function when content is saved
          console.log('[API] ✅ Agent ready to receive content from discovery pipeline');
          
        } catch (agentError) {
          console.error('[API] Failed to create AI agent for patch:', agentError);
          // Non-fatal - patch creation still succeeds
        }
      })();
    } catch (agentSetupError) {
      console.error('[API] Error setting up AI agent creation:', agentSetupError);
      // Non-fatal - continue with patch creation
    }

    // Auto-start discovery (background task - don't block response)
    // Wait for Wikipedia monitoring to initialize, then start discovery engine directly
    try {
      console.log('[API] Scheduling auto-start discovery for new patch:', { patchId: patch.id, handle: patch.handle });
      
      // Wait a bit for Wikipedia monitoring to initialize first, then start discovery
      setTimeout(async () => {
        try {
          // Import discovery engine and related functions
          const { runOpenEvidenceEngine } = await import('@/lib/discovery/engine');
          const { generateGuideSnapshot, seedFrontierFromPlan } = await import('@/lib/discovery/planner');
          const { clearFrontier, storeDiscoveryPlan } = await import('@/lib/redis/discovery');
          
          // Check if DEEPSEEK_API_KEY is configured
          if (!process.env.DEEPSEEK_API_KEY) {
            console.warn('[API] DEEPSEEK_API_KEY not configured - skipping auto-start discovery');
            return;
          }

          // Create discovery run
          const run = await (prisma as any).discoveryRun.create({
            data: {
              patchId: patch.id,
              status: 'queued'
            }
          });

          // Generate or use existing guide
          let guide = patch.guide as any;
          if (!guide) {
            const entity = (rawEntity ?? {}) as { name?: string; aliases?: string[] };
            const topic = entity?.name && entity.name.trim().length ? entity.name.trim() : title;
            const aliases = Array.isArray(entity?.aliases) && entity.aliases.length
              ? entity.aliases.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
              : tags.filter((tag: any): tag is string => typeof tag === 'string' && tag.trim().length > 0);

            guide = await generateGuideSnapshot(topic, aliases);
            await prisma.patch.update({
              where: { id: patch.id },
              data: { guide: guide as unknown as Prisma.JsonObject }
            });
          }

          // Clear frontier and seed from plan
          await clearFrontier(patch.id).catch((error) => {
            console.warn('[API] Failed to clear frontier before seeding', error);
          });

          await storeDiscoveryPlan(run.id, guide).catch((error) => {
            console.error('[API] Failed to cache discovery plan', error);
          });

          await seedFrontierFromPlan(patch.id, guide).catch((error) => {
            console.error('[API] Failed to seed frontier from guide', error);
          });

          // Mark run as live
          await (prisma as any).discoveryRun.update({
            where: { id: run.id },
            data: {
              status: 'live',
              startedAt: new Date()
            }
          });

          // Start discovery engine
          console.log('[API] Auto-starting discovery engine:', { patchId: patch.id, runId: run.id });
          runOpenEvidenceEngine({
            patchId: patch.id,
            patchHandle: patch.handle,
            patchName: patch.title,
            runId: run.id
          }).catch((error) => {
            console.error('[API] Auto-start discovery engine failed:', error);
            // Update run status to error
            (prisma as any).discoveryRun.update({
              where: { id: run.id },
              data: { status: 'error' }
            }).catch(() => {});
          });
        } catch (error) {
          console.error('[API] Error auto-starting discovery:', error);
          // Non-fatal - discovery can be started manually later
        }
      }, 3000); // Wait 3 seconds for Wikipedia monitoring to complete
    } catch (discoveryError) {
      console.error('[API] Error setting up auto-discovery:', discoveryError);
      // Non-fatal - continue with patch creation
    }

    // Return the created patch
    return NextResponse.json({
      success: true,
      patch: {
        id: patch.id,
        handle: patch.handle,
        title: patch.title,
        description: patch.description,
        tags: patch.tags,
        theme: patch.theme,
        createdAt: patch.createdAt,
        updatedAt: patch.updatedAt,
        entity: patch.entity,
        guide,
        creator: patch.creator,
        _count: patch._count
      }
    });

  } catch (error) {
    console.error('[API] ===== ERROR IN PATCHES POST =====');
    console.error('[API] Error creating patch:', error);
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: { params: Promise<{}> }) {
  console.error('[CRITICAL] PATCHES GET ENDPOINT CALLED');
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause for search
    const where = search ? {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { tags: { has: search } }
      ]
    } : {};

    // Fetch patches
    const patches = await prisma.patch.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true
          }
        },
        _count: {
          select: {
            members: true,
            posts: true,
            events: true,
            sources: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    return NextResponse.json({
      success: true,
      patches
    });

  } catch (error) {
    console.error('Error fetching patches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}
