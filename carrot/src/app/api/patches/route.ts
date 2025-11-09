console.log('--- TOP OF PATCHES ROUTE FILE LOADED ---');
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { OPEN_EVIDENCE_V2 } from '@/lib/flags';
import { generateGuideSnapshot } from '@/lib/discovery/planner';

function sanitizeEntity(rawEntity: any) {
  if (!rawEntity || typeof rawEntity !== 'object') return undefined;
  const name = typeof rawEntity.name === 'string' ? rawEntity.name.trim() : undefined;
  const aliases = Array.isArray(rawEntity.aliases)
    ? rawEntity.aliases.filter((value: unknown): value is string => typeof value === 'string' && value.trim()).map((value) => value.trim())
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
        entity: rawEntity,
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
          ? (rawEntity.aliases as string[])
          : tags.filter((tag: any): tag is string => typeof tag === 'string' && tag.trim());
        guide = await generateGuideSnapshot(topic, aliases);
        await prisma.patch.update({
          where: { id: patch.id },
          data: {
            guide
          }
        });
      } catch (guideError) {
        console.error('[API] Failed to generate discovery guide during patch creation', guideError);
      }
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
        { name: { contains: search, mode: 'insensitive' as const } },
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
