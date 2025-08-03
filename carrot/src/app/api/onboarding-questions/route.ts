import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/onboarding-questions
export async function GET() {
  const questions = await prisma.onboardingQuestion.findMany({
    orderBy: { id: 'asc' }
  });
  return NextResponse.json(questions);
}

// POST /api/onboarding-questions (admin only)
export async function POST(req: NextRequest) {
  // TODO: Add admin auth check
  const data = await req.json();
  const question = await prisma.onboardingQuestion.create({
    data,
  });
  return NextResponse.json(question);
}
