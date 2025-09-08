import { NextResponse } from 'next/server';
import path from 'path';

function getDbPath() {
  const raw = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const p = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

// Expected columns (SQLite physical table names)
const EXPECTED: Record<string, string[]> = {
  'User': [
    'id','name','email','email_verified','image','profilePhoto','profile_photo_path',
    'isOnboarded','username','firstName','lastName','phone','country','postalCode',
    'metadata','interests','tos_accepted_at','privacy_accepted_at','tos_version','privacy_version'
  ],
  'posts': [
    'id','content','userId','gradientDirection','gradientFromColor','gradientViaColor','gradientToColor',
    'imageUrls','gifUrl','audioUrl','audioTranscription','transcriptionStatus','emoji','carrotText','stickText',
    'createdAt','updatedAt','thumbnailUrl','videoUrl','cf_uid','cf_status','cf_duration_sec','cf_width','cf_height','cf_playback_url_hls','caption_vtt_url'
  ],
  'media_assets': [
    'id','user_id','type','url','storage_path','thumb_url','thumb_path','title','hidden','source','duration_sec','width','height','in_use_count','created_at','updated_at','cf_uid','cf_status'
  ],
};

function inspectTable(db: any, table: string) {
  try {
    const cols: Array<{ name: string }> = db.prepare(`PRAGMA table_info(${table})`).all();
    const names = cols.map(c => c.name);
    const expected = EXPECTED[table] || [];
    const missing = expected.filter(x => !names.includes(x));
    const extra = names.filter(x => !expected.includes(x));
    return { ok: true, table, columns: names, missing, extra };
  } catch (e: any) {
    return { ok: false, table, error: String(e?.message || e) };
  }
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

    const results = [
      inspectTable(db, '"User"'),
      inspectTable(db, 'posts'),
      inspectTable(db, 'media_assets'),
    ];

    db.close();
    return NextResponse.json({ ok: true, db: absPath, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
