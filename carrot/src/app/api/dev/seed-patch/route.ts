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
        name: 'Term Limits for Politicians',
        tagline: 'Advocating for congressional term limits to prevent career politicians',
        description: 'A comprehensive movement to establish term limits for members of Congress and other elected officials to ensure fresh perspectives and prevent the concentration of power in long-serving politicians.',
        rules: '1. Be respectful in discussions\n2. Provide sources for claims\n3. Focus on policy, not personalities\n4. No spam or off-topic content',
        tags: ['politics', 'reform', 'congress', 'democracy', 'governance'],
        theme: 'light',
        createdBy: user.id,
      }
    });
    console.log('✅ Created/updated patch:', termLimitsPatch.name);

    // Create the History patch
    const historyPatch = await prisma.patch.upsert({
      where: { handle: 'history' },
      update: {},
      create: {
        handle: 'history',
        name: 'History',
        tagline: 'Comprehensive historical research and documentation',
        description: 'A scholarly repository dedicated to historical research, documentation, and analysis. Explore historical events, sources, and scholarly discussions.',
        rules: '1. Maintain academic rigor\n2. Cite primary sources\n3. Respect historical accuracy\n4. Encourage scholarly debate',
        tags: ['history', 'research', 'scholarship', 'documentation', 'academia'],
        theme: 'stone',
        createdBy: user.id,
      }
    });
    console.log('✅ Created/updated patch:', historyPatch.name);

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

    return NextResponse.json({ 
      success: true, 
      message: 'Patch data seeded successfully',
      patches: [
        {
          id: termLimitsPatch.id,
          handle: termLimitsPatch.handle,
          name: termLimitsPatch.name
        },
        {
          id: historyPatch.id,
          handle: historyPatch.handle,
          name: historyPatch.name
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
