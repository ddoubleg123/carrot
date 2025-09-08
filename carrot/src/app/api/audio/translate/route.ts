import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(_request: Request, _ctx: { params: Promise<{}> }) {
  return NextResponse.json(
    { error: 'Translation endpoint disabled: OpenAI usage removed.' },
    { status: 501 }
  );
}
