import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import prisma from '../../../../lib/prisma';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    // Mirror prisma SQLite resolution to report actual DB file being used
    const raw = process.env.DATABASE_URL;
    let resolved: string | undefined = undefined;
    let filePath: string | null = null;
    const resolveSqliteUrl = (url?: string): string | undefined => {
      if (!url) return undefined;
      if (!url.startsWith('file:')) return url;
      const p = url.slice('file:'.length);
      const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
      let candidate = abs;
      try {
        const exists = fs.existsSync(candidate);
        if (!exists) {
          const alt = candidate.replace(new RegExp(`${path.sep}carrot${path.sep}prisma${path.sep}`), `${path.sep}prisma${path.sep}`);
          if (alt !== candidate && fs.existsSync(alt)) {
            candidate = alt;
          }
        }
      } catch {}
      const normalized = candidate.replace(/\\/g, '/');
      return `file:${normalized}`;
    };
    resolved = resolveSqliteUrl(raw);
    if (resolved?.startsWith('file:')) filePath = resolved.slice('file:'.length);

    const [userCount, postCount] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
    ]);

    const latestPosts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        User: { select: { id: true, email: true, username: true, image: true, profilePhoto: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        CWD: process.cwd(),
        DATABASE_URL: process.env.DATABASE_URL,
        DATABASE_URL_RESOLVED: resolved,
        SQLITE_FILEPATH: filePath,
        SQLITE_DIR_EXISTS: filePath ? fs.existsSync(path.dirname(filePath)) : undefined,
        SQLITE_FILE_EXISTS: filePath ? fs.existsSync(filePath) : undefined,
      },
      counts: { users: userCount, posts: postCount },
      latestPosts,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
