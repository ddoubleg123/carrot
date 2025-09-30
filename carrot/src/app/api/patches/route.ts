import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { name, description, tags = [], categories = [] } = body;

    // Validate required fields
    if (!name || !name.trim()) {
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
    console.error('Error creating patch:', error);
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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
