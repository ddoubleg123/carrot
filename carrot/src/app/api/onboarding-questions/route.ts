import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/onboarding-questions
export const runtime = 'nodejs';

export async function GET(_req: Request, _ctx: { params: Promise<{}> }) {
  const questions = await prisma.onboardingQuestion.findMany({
    orderBy: { id: 'asc' }
  });
  return NextResponse.json(questions);
}

// POST /api/onboarding-questions (admin only)
export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  // TODO: Add admin auth check
  const data = await req.json();
  const question = await prisma.onboardingQuestion.create({
    data,
  });
  return NextResponse.json(question);
}
