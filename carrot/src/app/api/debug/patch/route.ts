import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Test database connection
    const dbTest = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Database connection test:', dbTest);

    // Check if the specific patch exists
    const patch = await prisma.patch.findUnique({
      where: { handle: 'term-limits-politicians' },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            profilePhoto: true,
            image: true,
          }
        },
        facts: {
          include: {
            source: true
          }
        },
        events: {
          include: {
            sources: true
          },
          orderBy: {
            dateStart: 'desc'
          },
          take: 20
        },
        sources: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 15
        },
        posts: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                profilePhoto: true,
                image: true,
                country: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 25
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                profilePhoto: true,
                image: true,
              }
            }
          },
          orderBy: {
            joinedAt: 'desc'
          },
          take: 10
        },
        _count: {
          select: {
            members: true,
            posts: true,
            events: true,
            sources: true,
          }
        }
      }
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      databaseConnection: 'OK',
      patchExists: !!patch,
      patchData: patch ? {
        id: patch.id,
        handle: patch.handle,
        name: patch.name,
        tagline: patch.tagline,
        theme: patch.theme,
        factsCount: patch.facts.length,
        eventsCount: patch.events.length,
        sourcesCount: patch.sources.length,
        postsCount: patch.posts.length,
        membersCount: patch.members.length,
        counts: patch._count
      } : null,
      error: null
    });
  } catch (error) {
    console.error('Patch debug error:', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      databaseConnection: 'ERROR',
      patchExists: false,
      patchData: null,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
