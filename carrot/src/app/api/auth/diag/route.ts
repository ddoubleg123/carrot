import { NextResponse } from 'next/server';
import { authOptions } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const env = process.env;
    const summary = {
      NEXTAUTH_URL: Boolean(env.NEXTAUTH_URL),
      NEXTAUTH_SECRET: Boolean(env.NEXTAUTH_SECRET),
      AUTH_TRUST_HOST: env.AUTH_TRUST_HOST ?? 'unset',
      GOOGLE_CLIENT_ID: Boolean(env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: Boolean(env.GOOGLE_CLIENT_SECRET),
      DATABASE_URL_present: Boolean(env.DATABASE_URL),
      nodeEnv: env.NODE_ENV,
    };

    // Try to materialize providers config to surface errors early
    let providersOk = true;
    let providersError: any = null;
    try {
      const prov = authOptions.providers as any[];
      providersOk = Array.isArray(prov) && prov.length > 0;
    } catch (e: any) {
      providersOk = false;
      providersError = String(e?.message || e);
    }

    // Ping Prisma via a lightweight query to ensure adapter DB is reachable
    let dbOk = true;
    let dbError: any = null;
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
    } catch (e: any) {
      dbOk = false;
      dbError = String(e?.message || e);
    }

    return NextResponse.json({ ok: true, summary, providersOk, providersError, dbOk, dbError });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
