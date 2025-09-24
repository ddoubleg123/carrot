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
    const patch = await prisma.patch.upsert({
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
    console.log('✅ Created/updated patch:', patch.name);

    // Create some basic facts
    const facts = [
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

    for (const fact of facts) {
      await prisma.fact.upsert({
        where: {
          patchId_label: {
            patchId: patch.id,
            label: fact.label,
          }
        },
        update: {},
        create: {
          patchId: patch.id,
          label: fact.label,
          value: fact.value,
        }
      });
    }
    console.log('✅ Created facts');

    // Create a member
    await prisma.patchMember.upsert({
      where: {
        patch_user_member_unique: {
          patchId: patch.id,
          userId: user.id,
        }
      },
      update: {},
      create: {
        patchId: patch.id,
        userId: user.id,
        role: 'admin',
      }
    });
    console.log('✅ Created member');

    return NextResponse.json({ 
      success: true, 
      message: 'Patch data seeded successfully',
      patch: {
        id: patch.id,
        handle: patch.handle,
        name: patch.name
      }
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
