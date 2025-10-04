import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get all active training plans
    const trainingPlans = await prisma.trainingPlan.findMany({
      where: {
        status: {
          in: ['pending', 'running', 'paused']
        }
      },
      select: {
        id: true,
        status: true,
        options: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Calculate totals
    const totals = {
      queued: 0,
      running: 0,
      done: 0,
      failed: 0,
      skipped: 0,
      dropped: 0,
      fed: 0
    };

    // Count by status
    trainingPlans.forEach(plan => {
      switch (plan.status) {
        case 'pending':
          totals.queued++;
          break;
        case 'running':
          totals.running++;
          break;
        case 'completed':
          totals.done++;
          break;
        case 'failed':
          totals.failed++;
          break;
        case 'canceled':
          totals.skipped++;
          break;
      }
    });

    // Check if any plans are paused
    const pausedPlans = trainingPlans.filter(plan => {
      try {
        const options = typeof plan.options === 'string' 
          ? JSON.parse(plan.options) 
          : plan.options;
        return options?.pauseDiscovery === true;
      } catch {
        return false;
      }
    });

    const response = {
      success: true,
      totals,
      plans: trainingPlans.map(plan => ({
        id: plan.id,
        status: plan.status,
        isPaused: (() => {
          try {
            const options = typeof plan.options === 'string' 
              ? JSON.parse(plan.options) 
              : plan.options;
            return options?.pauseDiscovery === true;
          } catch {
            return false;
          }
        })(),
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      })),
      isPaused: pausedPlans.length > 0,
      activePlans: trainingPlans.length,
      pausedPlans: pausedPlans.length
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching training status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch training status',
        totals: {
          queued: 0,
          running: 0,
          done: 0,
          failed: 0,
          skipped: 0,
          dropped: 0,
          fed: 0
        },
        plans: [],
        isPaused: false,
        activePlans: 0,
        pausedPlans: 0
      },
      { status: 500 }
    );
  }
}
