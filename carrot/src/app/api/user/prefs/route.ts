import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// Use NextAuth helper directly
async function getSessionUserId(): Promise<string | null> {
  try {
    const session = await auth();
    const uid = (session as any)?.user?.id || (session as any)?.user?.uid || null;
    return uid ?? null;
  } catch {
    return null;
  }
}

const cookieName = 'carrot_prefs';

function readPrefsCookieFromReq(req: NextRequest): { captionsDefault?: boolean; reducedMotion?: boolean; autoplay?: boolean } | null {
  try {
    const c = req.cookies.get(cookieName)?.value;
    if (!c) return null;
    const obj = JSON.parse(c);
    if (obj && (obj.v === 1 || obj.v === undefined)) {
      return {
        captionsDefault: typeof obj.captionsDefault === 'boolean' ? obj.captionsDefault : undefined,
        reducedMotion: typeof obj.reducedMotion === 'boolean' ? obj.reducedMotion : undefined,
        autoplay: typeof obj.autoplay === 'boolean' ? obj.autoplay : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writePrefsCookie(res: NextResponse, prefs: { captionsDefault?: boolean; reducedMotion?: boolean; autoplay?: boolean }) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const payload = JSON.stringify({ v: 1, ...prefs });
    res.cookies.set({
      name: cookieName,
      value: payload,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      // domain only in prod if you have a shared domain
      ...(isProd && process.env.NEXT_PUBLIC_COOKIE_DOMAIN ? { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN } : {}),
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    } as any);
  } catch {}
}

function deletePrefsCookie(res: NextResponse) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookies.set({
      name: cookieName,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      ...(isProd && process.env.NEXT_PUBLIC_COOKIE_DOMAIN ? { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN } : {}),
      path: '/',
      maxAge: 0,
    } as any);
  } catch {}
}

export async function GET(_req: NextRequest) {
  const uid = await getSessionUserId();

  if (uid) {
    // Authenticated: read from DB
    try {
      const prefs = await prisma.userPref.findUnique({ where: { userId: uid } });
      const body = {
        captionsDefault: prefs?.captionsDefault ?? true,
        reducedMotion: prefs?.reducedMotion ?? false,
        autoplay: prefs?.autoplay ?? true,
      };
      return NextResponse.json(body, { status: 200 });
    } catch (e) {
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }
  }

  // Guest: return cookie fallback or defaults
  const c = readPrefsCookieFromReq(_req);
  return NextResponse.json({
    captionsDefault: c?.captionsDefault ?? true,
    reducedMotion: c?.reducedMotion ?? false,
    autoplay: c?.autoplay ?? true,
  }, { status: 200 });
}

export async function PUT(req: NextRequest) {
  const uid = await getSessionUserId();
  const data = await req.json().catch(() => ({}));
  const payload: { captionsDefault?: boolean; reducedMotion?: boolean; autoplay?: boolean } = {};
  if (typeof data.captionsDefault === 'boolean') payload.captionsDefault = data.captionsDefault;
  if (typeof data.reducedMotion === 'boolean') payload.reducedMotion = data.reducedMotion;
  if (typeof data.autoplay === 'boolean') payload.autoplay = data.autoplay;

  if (uid) {
    try {
      const prefs = await prisma.userPref.upsert({
        where: { userId: uid },
        update: payload,
        create: { userId: uid, ...payload },
      });
      const res = NextResponse.json({
        captionsDefault: prefs.captionsDefault,
        reducedMotion: prefs.reducedMotion,
        autoplay: prefs.autoplay,
      }, { status: 200 });
      // Clear guest cookie upon login/migration
      deletePrefsCookie(res);
      return res;
    } catch (e) {
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }
  }

  // Guest: write cookie fallback
  const res = NextResponse.json({
    captionsDefault: payload.captionsDefault ?? true,
    reducedMotion: payload.reducedMotion ?? false,
    autoplay: payload.autoplay ?? true,
  }, { status: 200 });
  writePrefsCookie(res, payload);
  return res;
}
