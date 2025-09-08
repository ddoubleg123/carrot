import { NextResponse } from 'next/server';
import path from 'path';

function getDbPath() {
  const raw = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const p = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

export const runtime = 'nodejs';

// GET-friendly
export async function GET(_req: Request, _ctx: { params: Promise<{}> }) {
  return POST(_req, _ctx);
}

export async function POST(_req: Request, _ctx: { params: Promise<{}> }) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'Disabled in production' }, { status: 403 });
    }

    const absPath = getDbPath();
    let Database: any;
    try {
      const req = eval('require') as NodeRequire;
      Database = req('better-sqlite3');
    } catch {
      return NextResponse.json({ ok: false, error: 'better-sqlite3 not installed' }, { status: 500 });
    }
    const db = new Database(absPath);

    const cols: Array<{ name: string }> = db.prepare(`PRAGMA table_info("User")`).all();
    const current = new Set(cols.map(c => c.name));

    const desired: Array<{ name: string; ddl: string }> = [
      { name: 'email_verified', ddl: 'ALTER TABLE "User" ADD COLUMN email_verified TEXT' },
      { name: 'firstName', ddl: 'ALTER TABLE "User" ADD COLUMN firstName TEXT' },
      { name: 'lastName', ddl: 'ALTER TABLE "User" ADD COLUMN lastName TEXT' },
      { name: 'phone', ddl: 'ALTER TABLE "User" ADD COLUMN phone TEXT' },
      { name: 'country', ddl: 'ALTER TABLE "User" ADD COLUMN country TEXT' },
      { name: 'postalCode', ddl: 'ALTER TABLE "User" ADD COLUMN postalCode TEXT' },
      { name: 'interests', ddl: 'ALTER TABLE "User" ADD COLUMN interests TEXT' },
      { name: 'metadata', ddl: 'ALTER TABLE "User" ADD COLUMN metadata TEXT' },
      { name: 'profile_photo_path', ddl: 'ALTER TABLE "User" ADD COLUMN profile_photo_path TEXT' },
    ];

    const added: string[] = [];
    for (const d of desired) {
      if (!current.has(d.name)) {
        try {
          db.exec(d.ddl);
          added.push(d.name);
        } catch (e) {
          added.push(`${d.name}:ERROR:${String((e as any)?.message || e)}`);
        }
      }
    }

    const after: Array<{ name: string }> = db.prepare(`PRAGMA table_info("User")`).all();
    db.close();
    return NextResponse.json({ ok: true, db: absPath, added, columns: after.map(c => c.name) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
