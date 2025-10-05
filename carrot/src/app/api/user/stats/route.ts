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

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        posts: {
          select: {
            id: true,
            createdAt: true,
            carrotText: true,
            stickText: true,
          }
        },
        postLikes: {
          select: {
            id: true,
            createdAt: true,
          }
        },
        postSaves: {
          select: {
            id: true,
            createdAt: true,
          }
        },
        comments: {
          select: {
            id: true,
            createdAt: true,
          }
        },
        patchMemberships: {
          select: {
            id: true,
            joinedAt: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate carrots earned from posts
    const carrotsFromPosts = user.posts.reduce((total, post) => {
      const carrots = post.carrotText ? parseInt(post.carrotText) || 0 : 0;
      const sticks = post.stickText ? parseInt(post.stickText) || 0 : 0;
      return total + carrots - sticks; // Carrots minus sticks
    }, 0);

    // Calculate engagement-based carrots
    const likesReceived = user.postLikes.length;
    const commentsReceived = user.comments.length;
    const savesReceived = user.postSaves.length;
    const patchesJoined = user.patchMemberships.length;

    // Engagement multiplier (1 carrot per 10 likes, 1 per 5 comments, etc.)
    const engagementCarrots = Math.floor(
      (likesReceived / 10) + 
      (commentsReceived / 5) + 
      (savesReceived / 3) + 
      (patchesJoined * 2)
    );

    // Calculate weekly stats
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklyPosts = user.posts.filter(post => 
      new Date(post.createdAt) >= oneWeekAgo
    ).length;
    
    const weeklyLikes = user.postLikes.filter(like => 
      new Date(like.createdAt) >= oneWeekAgo
    ).length;

    // Calculate streak (consecutive days with activity)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let streakDays = 0;
    let currentDate = new Date(today);
    
    // Check if user was active today
    const hasActivityToday = user.posts.some(post => 
      new Date(post.createdAt).toDateString() === today.toDateString()
    );
    
    if (hasActivityToday) {
      streakDays = 1;
      currentDate = yesterday;
      
      // Count consecutive days backwards
      while (true) {
        const hasActivity = user.posts.some(post => 
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
