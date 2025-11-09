import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  try {
    console.log('🌱 Seeding patch data...');

    // Find or create a user
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: 'seed-user-1',
          email: 'seed@example.com',
          name: 'Seed User',
          username: 'seeduser',
          profilePhoto: '/default-avatar.png',
          isOnboarded: true,
        }
      });
      console.log('✅ Created user:', user.email);
    } else {
      console.log('✅ Found user:', user.email);
    }

    // Create the main patch: "Term Limits for Politicians"
    const termLimitsPatch = await prisma.patch.upsert({
      where: { handle: 'term-limits-politicians' },
      update: {},
      create: {
        handle: 'term-limits-politicians',
        title: 'Term Limits for Politicians',
        tagline: 'Advocating for congressional term limits to prevent career politicians',
        description: 'A comprehensive movement to establish term limits for members of Congress and other elected officials to ensure fresh perspectives and prevent the concentration of power in long-serving politicians.',
        rules: '1. Be respectful in discussions\n2. Provide sources for claims\n3. Focus on policy, not personalities\n4. No spam or off-topic content',
        tags: ['politics', 'reform', 'congress', 'democracy', 'governance'],
        theme: 'light',
        createdBy: user.id,
      }
    });
    console.log('✅ Created/updated patch:', termLimitsPatch.title);

    // Create the History patch
    const historyPatch = await prisma.patch.upsert({
      where: { handle: 'history' },
      update: {},
      create: {
        handle: 'history',
        title: 'History',
        tagline: 'Comprehensive historical research and documentation',
        description: 'A scholarly repository dedicated to historical research, documentation, and analysis. Explore historical events, sources, and scholarly discussions.',
        rules: '1. Maintain academic rigor\n2. Cite primary sources\n3. Respect historical accuracy\n4. Encourage scholarly debate',
        tags: ['history', 'research', 'scholarship', 'documentation', 'academia'],
        theme: 'stone',
        createdBy: user.id,
      }
    });
    console.log('✅ Created/updated patch:', historyPatch.title);

    // Create some basic facts for term limits patch
    const termLimitsFacts = [
      {
        label: 'Current Status',
        value: 'No federal term limits exist for Congress. Representatives serve 2-year terms with no limit, Senators serve 6-year terms with no limit.',
      },
      {
        label: 'Proposed Limit (House)',
        value: 'Typically 3-6 terms (6-12 years).',
      },
      {
        label: 'Proposed Limit (Senate)',
        value: 'Typically 2 terms (12 years).',
      },
    ];

    for (const fact of termLimitsFacts) {
      // Check if fact already exists
      const existingFact = await prisma.fact.findFirst({
        where: {
          patchId: termLimitsPatch.id,
          label: fact.label,
        }
      });
      
      if (!existingFact) {
        await prisma.fact.create({
          data: {
            patchId: termLimitsPatch.id,
            label: fact.label,
            value: fact.value,
          }
        });
      }
    }
    console.log('✅ Created term limits facts');

    // Create some basic facts for history patch
    const historyFacts = [
      {
        label: 'Research Focus',
        value: 'Primary source documentation, historical analysis, and scholarly research across all historical periods.',
      },
      {
        label: 'Methodology',
        value: 'Evidence-based historical research with emphasis on primary sources and peer review.',
      },
      {
        label: 'Scope',
        value: 'Global historical coverage from ancient civilizations to modern history.',
      },
    ];

    for (const fact of historyFacts) {
      // Check if fact already exists
      const existingFact = await prisma.fact.findFirst({
        where: {
          patchId: historyPatch.id,
          label: fact.label,
        }
      });
      
      if (!existingFact) {
        await prisma.fact.create({
          data: {
            patchId: historyPatch.id,
            label: fact.label,
            value: fact.value,
          }
        });
      }
    }
    console.log('✅ Created history facts');

    // Create members for both patches
    await prisma.patchMember.upsert({
      where: {
        patch_user_member_unique: {
          patchId: termLimitsPatch.id,
          userId: user.id,
        }
      },
      update: {},
      create: {
        patchId: termLimitsPatch.id,
        userId: user.id,
        role: 'admin',
      }
    });

    await prisma.patchMember.upsert({
      where: {
        patch_user_member_unique: {
          patchId: historyPatch.id,
          userId: user.id,
        }
      },
      update: {},
      create: {
        patchId: historyPatch.id,
        userId: user.id,
        role: 'admin',
      }
    });
    console.log('✅ Created members');

    // Create sample events for timeline with different media types
    const sampleEvents = [
      {
        title: 'Founding of the Movement',
        summary: 'The term limits movement was officially founded with the goal of establishing congressional term limits.',
        dateStart: new Date('2020-01-15'),
        dateEnd: new Date('2020-01-15'),
        tags: ['founding', 'movement'],
        media: {
          type: 'image',
          url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&h=600&fit=crop',
          alt: 'Congress building'
        }
      },
      {
        title: 'First Major Rally',
        summary: 'Over 10,000 supporters gathered in Washington DC to demand congressional term limits.',
        dateStart: new Date('2020-06-15'),
        dateEnd: new Date('2020-06-15'),
        tags: ['rally', 'protest'],
        media: {
          type: 'video',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          alt: 'Rally footage'
        }
      },
      {
        title: 'Research Paper Published',
        summary: 'Dr. Sarah Chen published groundbreaking research on the effectiveness of term limits.',
        dateStart: new Date('2021-03-20'),
        dateEnd: new Date('2021-03-20'),
        tags: ['research', 'academic'],
        media: {
          type: 'pdf',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          alt: 'Research paper'
        }
      },
      {
        title: 'State Legislature Success',
        summary: 'First state legislature passed a resolution supporting federal term limits.',
        dateStart: new Date('2021-08-10'),
        dateEnd: new Date('2021-08-10'),
        tags: ['legislation', 'success'],
        media: {
          type: 'image',
          url: 'https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800&h=600&fit=crop',
          alt: 'State capitol'
        }
      },
      {
        title: 'Public Opinion Poll Results',
        summary: 'New poll shows 78% of Americans support congressional term limits.',
        dateStart: new Date('2022-01-15'),
        dateEnd: new Date('2022-01-15'),
        tags: ['polling', 'public-opinion'],
        media: {
          type: 'video',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
          alt: 'Poll results presentation'
        }
      }
    ];

    // Create events for term limits patch
    for (const eventData of sampleEvents) {
      const existingEvent = await prisma.event.findFirst({
        where: {
          patchId: termLimitsPatch.id,
          title: eventData.title
        }
      });
      
      if (!existingEvent) {
        await prisma.event.create({
          data: {
            patchId: termLimitsPatch.id,
            title: eventData.title,
            summary: eventData.summary,
            dateStart: eventData.dateStart,
            dateEnd: eventData.dateEnd,
            tags: eventData.tags,
            media: eventData.media
          }
        });
      }
    }

    // Create sample events for history patch
    const historyEvents = [
      {
        title: 'Ancient Civilizations Research',
        summary: 'Comprehensive study of governance systems in ancient civilizations and their relevance to modern democracy.',
        dateStart: new Date('2023-01-10'),
        dateEnd: new Date('2023-01-10'),
        tags: ['ancient-history', 'governance'],
        media: {
          type: 'image',
          url: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73c6e?w=800&h=600&fit=crop',
          alt: 'Ancient ruins'
        }
      },
      {
        title: 'Medieval Political Systems',
        summary: 'Analysis of medieval political structures and their influence on modern governance.',
        dateStart: new Date('2023-03-15'),
        dateEnd: new Date('2023-03-15'),
        tags: ['medieval', 'politics'],
        media: {
          type: 'video',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          alt: 'Medieval documentary'
        }
      },
      {
        title: 'Modern Democracy Evolution',
        summary: 'Documentation of how modern democratic systems evolved from historical precedents.',
        dateStart: new Date('2023-06-20'),
        dateEnd: new Date('2023-06-20'),
        tags: ['democracy', 'modern-history'],
        media: {
          type: 'pdf',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          alt: 'Democracy research paper'
        }
      }
    ];

    for (const eventData of historyEvents) {
      const existingEvent = await prisma.event.findFirst({
        where: {
          patchId: historyPatch.id,
          title: eventData.title
        }
      });
      
      if (!existingEvent) {
        await prisma.event.create({
          data: {
            patchId: historyPatch.id,
            title: eventData.title,
            summary: eventData.summary,
            dateStart: eventData.dateStart,
            dateEnd: eventData.dateEnd,
            tags: eventData.tags,
            media: eventData.media
          }
        });
      }
    }

    console.log('✅ Created sample events with media');

    return NextResponse.json({ 
      success: true, 
      message: 'Patch data seeded successfully',
      patches: [
        {
          id: termLimitsPatch.id,
          handle: termLimitsPatch.handle,
          title: termLimitsPatch.title
        },
        {
          id: historyPatch.id,
          handle: historyPatch.handle,
          title: historyPatch.title
        }
      ]
    });

  } catch (error) {
    console.error('❌ Seed error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
