import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// Dev-only schema health report. Non-destructive.
// Checks presence of critical columns and returns a concise report.
export async function GET(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'Disabled in production' }, { status: 403 });
    }

    // Helper: PRAGMA table_info for a table
    const getCols = async (table: string): Promise<string[]> => {
      try {
        const rows: Array<{ name: string }> = await (prisma as any).$queryRawUnsafe(`PRAGMA table_info("${table}")`);
        return (rows || []).map(r => r.name);
      } catch {
        return [];
      }
    };

    const userCols = await getCols('User');
    // Post model maps to table name 'posts' via @@map("posts") in schema.prisma
    const postCols = await getCols('posts');

    const checks: Array<{ name: string; ok: boolean; details?: string }> = [];

    // User table critical fields
    const userExpected = [
      'email',
      'image',
      'profilePhoto',
      'profile_photo_path',
      'username',
    ];
    for (const c of userExpected) {
      checks.push({ name: `User.${c}`, ok: userCols.includes(c) });
    }

    // Post table gradient/HLS fields
    const postExpected = [
      'gradientDirection', 'gradientFromColor', 'gradientViaColor', 'gradientToColor',
      'cf_uid', 'cf_playback_url_hls',
    ];
    for (const c of postExpected) {
      checks.push({ name: `Post.${c}`, ok: postCols.includes(c) });
    }

    const allOk = checks.every(c => c.ok);
    return NextResponse.json({ ok: true, allOk, checks, meta: { userCols, postCols } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
