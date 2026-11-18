import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { createResilientFetch } from '@/lib/retryUtils';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [posts, likesReceived, commentsReceived, savesReceived, patchesJoined, weeklyLikes] = await Promise.all([
      prisma.post.findMany({
        where: { userId: user.id },
        select: { createdAt: true, carrotText: true, stickText: true },
      }),
      prisma.postLike.count({ where: { userId: user.id } }),
      prisma.comment.count({ where: { userId: user.id } }),
      prisma.postSave.count({ where: { userId: user.id } }),
      prisma.patchMember.count({ where: { userId: user.id } }),
      prisma.postLike.count({ where: { userId: user.id, createdAt: { gte: oneWeekAgo } } }),
    ]);

    const carrotsFromPosts = posts.reduce((total, post) => {
      const carrots = post.carrotText ? parseInt(post.carrotText) || 0 : 0;
      const sticks = post.stickText ? parseInt(post.stickText) || 0 : 0;
      return total + carrots - sticks;
    }, 0);

    // Engagement multiplier (1 carrot per 10 likes, 1 per 5 comments, etc.)
    const engagementCarrots = Math.floor(
      (likesReceived / 10) + 
      (commentsReceived / 5) + 
      (savesReceived / 3) + 
      (patchesJoined * 2)
    );

    const weeklyPosts = posts.filter(post =>
      new Date(post.createdAt) >= oneWeekAgo
    ).length;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let streakDays = 0;
    let currentDate = new Date(today);

    const hasActivityToday = posts.some(post =>
      new Date(post.createdAt).toDateString() === today.toDateString()
    );

    if (hasActivityToday) {
      streakDays = 1;
      currentDate = yesterday;

      while (true) {
        const hasActivity = posts.some(post =>
          new Date(post.createdAt).toDateString() === currentDate.toDateString()
        );
        
        if (hasActivity) {
          streakDays++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Total carrots earned
    const totalCarrots = Math.max(0, carrotsFromPosts + engagementCarrots);
    
    // Weekly goal (based on user activity)
    const weeklyGoal = Math.max(50, Math.floor(totalCarrots / 4)); // 25% of total as weekly goal
    const weeklyCurrent = Math.min(weeklyGoal, Math.floor(weeklyPosts * 10 + weeklyLikes / 5));
    const weeklyPercentage = Math.min(100, Math.round((weeklyCurrent / weeklyGoal) * 100));

    const stats = {
      totalCarrots,
      weeklyGoal,
      weeklyCurrent,
      weeklyPercentage,
      streakDays,
      breakdown: {
        carrotsFromPosts,
        engagementCarrots,
        likesReceived,
        commentsReceived,
        savesReceived,
        patchesJoined,
        weeklyPosts,
        weeklyLikes
      }
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 });
  }
}
