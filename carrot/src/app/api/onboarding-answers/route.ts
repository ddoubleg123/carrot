import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '../../../auth';

const prisma = new PrismaClient();

// GET /api/onboarding-answers (for current user)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const answers = await prisma.onboardingAnswer.findMany({
    where: { userId: session.user.id },
  });
  return NextResponse.json(answers);
}

// POST /api/onboarding-answers (submit answers for current user)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await req.json();
  // data: [{ questionId, answer }, ...]
  const userId = session.user.id;
  const created = await Promise.all(
    data.map((ans: { questionId: string, answer: any }) =>
      prisma.onboardingAnswer.upsert({
        where: {
          userId_questionId: {
            userId,
            questionId: ans.questionId
          }
        },
        update: { answer: ans.answer },
        create: { userId, questionId: ans.questionId, answer: ans.answer },
      })
    )
  );
  return NextResponse.json(created);
}
