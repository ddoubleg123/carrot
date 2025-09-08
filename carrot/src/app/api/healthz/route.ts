import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Lightweight DB check
    try {
      await (prisma as any).$queryRawUnsafe('SELECT 1');
    } catch (e) {
      return NextResponse.json({ ok: false, error: 'db_unavailable', details: String((e as any)?.message || e) }, { status: 503 });
    }

    return NextResponse.json({ ok: true, status: 'healthy' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
