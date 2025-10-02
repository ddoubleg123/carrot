console.log('--- TOP OF PATCHES ROUTE FILE LOADED ---');
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(request: Request, context: { params: Promise<{}> }) {
  console.log('[API] ===== PATCHES POST ENDPOINT CALLED =====');
  console.log('[API] Request URL:', request.url);
  console.log('[API] Request method:', request.method);
  console.log('[API] Timestamp:', new Date().toISOString());
  
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
    console.log('[API] Request headers:', Object.fromEntries(request.headers.entries()));
    let body;
    try {
      body = await request.json();
      console.log('[API] Received request body:', JSON.stringify(body, null, 2));
    } catch (error) {
      console.error('[API] Error parsing request body:', error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { name, description, tags = [], categories = [] } = body;

    // Validate required fields
    console.log('[API] Extracted fields:', { name, description, tags, categories });
    if (!name || !name.trim()) {
      console.log('[API] Validation failed: name is missing or empty');
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    // Generate a unique handle from the name
    const baseHandle = name
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
        name: name.trim(),
        description: description?.trim() || '',
        createdBy: session.user.id,
        tags: tags, // Use AI-generated tags
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

    // Return the created patch
    return NextResponse.json({
      success: true,
      patch: {
        id: patch.id,
        handle: patch.handle,
        name: patch.name,
        description: patch.description,
        tags: patch.tags,
        theme: patch.theme,
        createdAt: patch.createdAt,
        updatedAt: patch.updatedAt,
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
