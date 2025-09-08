// Next 15 validator-compliant signatures
import { auth } from '@/auth';
import path from 'path';

function getDbPath() {
  const raw = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const p = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

export const runtime = 'nodejs';

// Browser-friendly
export async function GET(req: Request, _ctx: { params: Promise<{}> }) {
  return POST(req, _ctx);
}

export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  try {
    const { searchParams } = new URL(req.url);
    const qUserId = searchParams.get('userId') || undefined;
    const qEmail = searchParams.get('email') || undefined;

    const absPath = getDbPath();
    let Database: any;
    try {
      const req = eval('require') as NodeRequire;
      Database = req('better-sqlite3');
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'better-sqlite3 not installed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const db = new Database(absPath);
    let userId: string | undefined;

    if (qUserId) {
      userId = qUserId;
    } else if (qEmail) {
      const row = db.prepare(`SELECT id FROM "User" WHERE email = ?`).get(qEmail);
      if (row?.id) userId = row.id as string;
    }
    if (!userId) {
      const session = await auth();
      if (!session?.user?.id) {
        return new Response('Unauthorized', { status: 401 });
      }
      userId = session.user.id as string;
    }

    // Ensure posts table exists (minimal schema sufficient for feed rendering)
    db.exec(`CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      userId TEXT NOT NULL,
      gradientDirection TEXT,
      gradientFromColor TEXT,
      gradientViaColor TEXT,
      gradientToColor TEXT,
      imageUrls TEXT,
      gifUrl TEXT,
      audioUrl TEXT,
      audioTranscription TEXT,
      transcriptionStatus TEXT,
      emoji TEXT,
      carrotText TEXT,
      stickText TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME,
      thumbnailUrl TEXT,
      videoUrl TEXT,
      cf_uid TEXT,
      cf_status TEXT,
      cf_duration_sec REAL,
      cf_width INTEGER,
      cf_height INTEGER,
      cf_playback_url_hls TEXT,
      caption_vtt_url TEXT
    );`);

    // Ensure media_assets table exists (already created by backfill)
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

    const assets = db.prepare(`SELECT * FROM media_assets WHERE user_id = ? ORDER BY datetime(COALESCE(created_at, CURRENT_TIMESTAMP)) DESC`).all(userId);
    let created = 0;

    const defaultGrad = {
      gradientDirection: 'to-br',
      gradientFromColor: '#0f172a',
      gradientViaColor: '#1f2937',
      gradientToColor: '#0f172a',
    };

    for (const a of assets) {
      const type = String(a.type || '').toLowerCase();
      if (type === 'video') {
        const ex = db.prepare(`SELECT id, content, gradientDirection, gradientFromColor, gradientViaColor, gradientToColor FROM posts WHERE videoUrl = ? AND userId = ?`).get(a.url, userId);
        if (!ex) {
          const id = 'post_' + Math.random().toString(36).slice(2, 10);
          const content = a.title || 'Imported media';
          const hls = a.cf_uid ? `https://videodelivery.net/${a.cf_uid}/manifest/video.m3u8` : null;
          const thumb = a.thumb_url || (a.cf_uid ? `https://videodelivery.net/${a.cf_uid}/thumbnails/thumbnail.jpg?time=1s` : null);
          db.prepare(`INSERT INTO posts (id, content, userId, thumbnailUrl, videoUrl, cf_playback_url_hls, gradientDirection, gradientFromColor, gradientViaColor, gradientToColor, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP)`).run(
            id, content, userId, thumb, a.url, hls, defaultGrad.gradientDirection, defaultGrad.gradientFromColor, defaultGrad.gradientViaColor, defaultGrad.gradientToColor, a.created_at || null
          );
          created++;
        } else {
          // Backfill gradients and content if missing/empty
          const needsGrad = !ex.gradientDirection || !ex.gradientFromColor || !ex.gradientToColor;
          const needsContent = !ex.content || ex.content.trim().length === 0;
          if (needsGrad || needsContent) {
            const content = needsContent ? (a.title || 'Imported media') : ex.content;
            db.prepare(`UPDATE posts SET content = ?, gradientDirection = COALESCE(gradientDirection, ?), gradientFromColor = COALESCE(gradientFromColor, ?), gradientViaColor = COALESCE(gradientViaColor, ?), gradientToColor = COALESCE(gradientToColor, ?), updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(
              content, defaultGrad.gradientDirection, defaultGrad.gradientFromColor, defaultGrad.gradientViaColor, defaultGrad.gradientToColor, ex.id
            );
          }
        }
      } else if (type === 'image') {
        const ex = db.prepare(`SELECT id, content, gradientDirection, gradientFromColor, gradientViaColor, gradientToColor FROM posts WHERE imageUrls = ? AND userId = ?`).get(a.url, userId);
        if (!ex) {
          const id = 'post_' + Math.random().toString(36).slice(2, 10);
          const content = a.title || 'Imported media';
          db.prepare(`INSERT INTO posts (id, content, userId, imageUrls, thumbnailUrl, gradientDirection, gradientFromColor, gradientViaColor, gradientToColor, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP)`).run(
            id, content, userId, a.url, a.url, defaultGrad.gradientDirection, defaultGrad.gradientFromColor, defaultGrad.gradientViaColor, defaultGrad.gradientToColor, a.created_at || null
          );
          created++;
        } else {
          const needsGrad = !ex.gradientDirection || !ex.gradientFromColor || !ex.gradientToColor;
          const needsContent = !ex.content || ex.content.trim().length === 0;
          if (needsGrad || needsContent) {
            const content = needsContent ? (a.title || 'Imported media') : ex.content;
            db.prepare(`UPDATE posts SET content = ?, gradientDirection = COALESCE(gradientDirection, ?), gradientFromColor = COALESCE(gradientFromColor, ?), gradientViaColor = COALESCE(gradientViaColor, ?), gradientToColor = COALESCE(gradientToColor, ?), updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(
              content, defaultGrad.gradientDirection, defaultGrad.gradientFromColor, defaultGrad.gradientViaColor, defaultGrad.gradientToColor, ex.id
            );
          }
        }
      }
    }

    const count = db.prepare(`SELECT COUNT(1) as c FROM posts WHERE userId = ?`).get(userId).c;
    db.close();

    return new Response(JSON.stringify({ ok: true, created, total: count }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
