// runtime and signatures aligned to Next 15 route validator
import path from 'path';

function getDbPath() {
  const raw = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const p = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

// Helper to derive storage path from public URL
function toPathFromPublic(u: string | null | undefined, publicBase: string): string | null {
  if (!u || typeof u !== 'string') return null;
  if (u.startsWith('http')) {
    if (u.startsWith(publicBase)) {
      const sliced = u.slice(publicBase.length);
      const q = sliced.indexOf('?');
      return q >= 0 ? sliced.slice(0, q) : sliced;
    }
    return null;
  }
  // Already a path; strip query if present
  const q = u.indexOf('?');
  return q >= 0 ? u.slice(0, q) : u;
}

export const runtime = 'nodejs';

// Browser-friendly
export async function GET(req: Request, _ctx: { params: Promise<{}> }) {
  return POST(req, _ctx);
}

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const { searchParams } = new URL(req.url);
    const targetEmail = searchParams.get('email');
    if (!targetEmail) {
      return new Response('Missing email', { status: 400 });
    }
    const desiredUsername = searchParams.get('username') || 'daniel';

    const absPath = getDbPath();
    let Database: any;
    try {
      const req = eval('require') as NodeRequire;
      Database = req('better-sqlite3');
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'better-sqlite3 not installed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const db = new Database(absPath);

    db.exec(`CREATE TABLE IF NOT EXISTS "User" (
      id TEXT PRIMARY KEY,
      email TEXT,
      username TEXT,
      name TEXT,
      image TEXT,
      profilePhoto TEXT,
      isOnboarded INTEGER DEFAULT 0,
      tos_accepted_at DATETIME,
      privacy_accepted_at DATETIME,
      tos_version TEXT,
      privacy_version TEXT
    );`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS User_email_key ON "User"(email);`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS User_username_key ON "User"(username);`);

    const user = db.prepare(`SELECT id,email,username,profilePhoto FROM "User" WHERE email = ?`).get(targetEmail);
    let userId = user?.id as string | undefined;
    if (!userId) {
      userId = `user_${Math.random().toString(36).slice(2,10)}`;
      db.prepare(`INSERT INTO "User" (id,email,username,isOnboarded) VALUES (?,?,?,1)`).run(userId, targetEmail, desiredUsername);
    }

    // Choose best avatar from media_assets
    db.exec(`CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      storage_path TEXT,
      thumb_url TEXT,
      thumb_path TEXT,
      title TEXT,
      hidden INTEGER DEFAULT 0,
      source TEXT,
      duration_sec REAL,
      width INTEGER,
      height INTEGER,
      in_use_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      cf_uid TEXT,
      cf_status TEXT
    );`);

    const img = db.prepare(`SELECT url, thumb_url, cf_uid FROM media_assets WHERE user_id = ? AND lower(type) = 'image' ORDER BY datetime(COALESCE(created_at, CURRENT_TIMESTAMP)) DESC LIMIT 1`).get(userId);
    let candidate: string | null = null;
    if (img) candidate = (img.cf_uid ? `https://videodelivery.net/${img.cf_uid}/thumbnails/thumbnail.jpg?time=1s` : (img.thumb_url || img.url));
    if (!candidate) {
      const any = db.prepare(`SELECT url, thumb_url, cf_uid FROM media_assets WHERE user_id = ? ORDER BY datetime(COALESCE(created_at, CURRENT_TIMESTAMP)) DESC LIMIT 1`).get(userId);
      if (any) candidate = (any.cf_uid ? `https://videodelivery.net/${any.cf_uid}/thumbnails/thumbnail.jpg?time=1s` : (any.thumb_url || any.url));
    }

    // Fallback: scan posts for Cloudflare HLS and derive thumbnail
    if (!candidate) {
      try {
        const post = db.prepare(`SELECT cf_playback_url_hls, videoUrl FROM posts WHERE userId = ? AND (cf_playback_url_hls IS NOT NULL OR (videoUrl LIKE 'https://videodelivery.net/%')) ORDER BY datetime(COALESCE(createdAt, CURRENT_TIMESTAMP)) DESC LIMIT 1`).get(userId);
        if (post) {
          let cfUid: string | null = null;
          const src = (post.cf_playback_url_hls as string | null) || (post.videoUrl as string | null);
          if (src) {
            const m = src.match(/https:\/\/videodelivery\.net\/([^\/]+)/i);
            if (m && m[1]) cfUid = m[1];
          }
          if (cfUid) candidate = `https://videodelivery.net/${cfUid}/thumbnails/thumbnail.jpg?time=1s`;
        }
      } catch {}
    }

    db.prepare(`UPDATE "User" SET username = ?, isOnboarded = 1 WHERE id = ?`).run(desiredUsername, userId);

    // Ensure durable path column exists (best-effort; ignore if already exists)
    try {
      db.exec(`ALTER TABLE "User" ADD COLUMN profile_photo_path TEXT`);
    } catch {}

    // Derive a durable path for avatar from media library
    const PUBLIC_BASE = process.env.STORAGE_PUBLIC_BASE || 'https://storage.googleapis.com/involuted-river-466315-p0.firebasestorage.app/';
    const assets = db.prepare(`SELECT type, url, storage_path, thumb_url, thumb_path, cf_uid FROM media_assets WHERE user_id = ? ORDER BY datetime(COALESCE(created_at, CURRENT_TIMESTAMP)) DESC`).all(userId);
    let chosenPath: string | null = null;
    for (const a of assets) {
      chosenPath = a.thumb_path || a.storage_path || toPathFromPublic(a.thumb_url, PUBLIC_BASE) || toPathFromPublic(a.url, PUBLIC_BASE);
      if (chosenPath) break;
    }

    const updates: any = { username: desiredUsername, isOnboarded: 1 };
    if (candidate) updates.profilePhoto = candidate;
    if (chosenPath) updates.profile_photo_path = chosenPath;
    const setPairs = Object.keys(updates).map(k => `${k === 'profile_photo_path' ? 'profile_photo_path' : k} = ?`).join(', ');
    const values = Object.values(updates);
    db.prepare(`UPDATE "User" SET ${setPairs} WHERE id = ?`).run(...values, userId);

    const out = db.prepare(`SELECT id,email,username,profilePhoto,profile_photo_path as profilePhotoPath,isOnboarded FROM "User" WHERE id = ?`).get(userId);
    db.close();
    return new Response(JSON.stringify({ ok: true, user: out, chosenAvatar: candidate || null, chosenPath: chosenPath || null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
