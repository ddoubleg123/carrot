import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { createMedia } from '@/lib/mediaServer';
import { join } from 'path';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { app as adminApp } from '@/lib/firebase-admin';
// @ts-ignore
const admin = require('firebase-admin');

const execAsync = promisify(exec);

export const runtime = 'nodejs';

// POST /api/media/backfill
// Ensures recent completed ingest jobs produce MediaAsset rows for the signed-in user.
export async function POST(request: Request, _ctx: { params: Promise<{}> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let limit = 10;
  let hours = 24;
  let all = false;
  let mode: string | null = null;
  try {
    const { searchParams } = new URL(request.url);
    const l = searchParams.get('limit');
    if (l) limit = Math.max(1, Math.min(100, parseInt(l, 10)));
    const h = searchParams.get('hours');
    if (h) hours = Math.max(1, Math.min(168, parseInt(h, 10))); // up to 7 days
    const a = searchParams.get('all');
    if (a === '1' || a === 'true') all = true;
    mode = searchParams.get('mode');
  } catch {}

  try {
    // Special mode: create Posts from existing MediaAsset rows
    if (mode === 'assets') {
      let created = 0;
      let skipped = 0;
      const assets = await (prisma as any).mediaAsset.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.min(1000, limit)),
      });

      for (const a of assets) {
        const t = String(a.type || '').toLowerCase();
        if (t === 'video') {
          const exists = await prisma.post.findFirst({ where: { userId, videoUrl: a.url } });
          if (exists) { skipped++; continue; }
          await prisma.post.create({
            data: {
              userId,
              content: a.title || 'Imported media',
              thumbnailUrl: a.thumbUrl || null,
              videoUrl: a.url,
              gradientDirection: 'to-br',
              gradientFromColor: '#0f172a',
              gradientViaColor: '#1f2937',
              gradientToColor: '#0f172a',
            }
          });
          created++;
        } else if (t === 'image') {
          const exists = await prisma.post.findFirst({ where: { userId, imageUrls: { equals: a.url } } });
          if (exists) { skipped++; continue; }
          await prisma.post.create({
            data: {
              userId,
              content: a.title || 'Imported image',
              imageUrls: a.url,
              thumbnailUrl: a.thumbUrl || a.url || null,
              gradientDirection: 'to-br',
              gradientFromColor: '#0f172a',
              gradientViaColor: '#1f2937',
              gradientToColor: '#0f172a',
            }
          });
          created++;
        } else if (t === 'gif') {
          const exists = await prisma.post.findFirst({ where: { userId, gifUrl: a.url } });
          if (exists) { skipped++; continue; }
          await prisma.post.create({
            data: {
              userId,
              content: a.title || 'Imported gif',
              gifUrl: a.url,
              thumbnailUrl: a.thumbUrl || null,
              gradientDirection: 'to-br',
              gradientFromColor: '#0f172a',
              gradientViaColor: '#1f2937',
              gradientToColor: '#0f172a',
            }
          });
          created++;
        } else {
          skipped++;
        }
      }

      return NextResponse.json({ ok: true, mode, created, examined: assets.length, limit });
    }

    // Special mode: create MediaAsset rows from Posts that have a videoUrl but no mediaAsset entry (Firebase-only healing)
    if (mode === 'postAssets') {
      const backfillWhere: any = {
        videoUrl: { not: null },
      };
      if (!all) {
        backfillWhere.createdAt = { gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
      }
      const posts = await prisma.post.findMany({
        where: backfillWhere,
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.min(500, limit)),
        select: { id: true, userId: true, content: true, thumbnailUrl: true, videoUrl: true },
      });
      let created = 0;
      let skipped = 0;
      for (const p of posts) {
        if (!p.videoUrl) { skipped++; continue; }
        const exists = await (prisma as any).mediaAsset.findFirst({ where: { userId: p.userId, url: p.videoUrl } });
        if (exists) { skipped++; continue; }
        await (prisma as any).mediaAsset.create({
          data: {
            userId: p.userId,
            url: p.videoUrl,
            type: 'video',
            title: (p.content && typeof p.content === 'string') ? p.content.slice(0, 80) : null,
            thumbUrl: p.thumbnailUrl || null,
            source: 'post-backfill',
          }
        });
        created++;
      }
      return NextResponse.json({ ok: true, mode, created, examined: posts.length, skipped });
    }

    // Note: Cloudflare-specific backfill (cfAssets) removed for Firebase-only plan

    // Special mode: sync missing thumbnails between Posts and MediaAsset entries
    if (mode === 'thumbs') {
      const wherePosts: any = {};
      if (!all) wherePosts.createdAt = { gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
      const posts = await prisma.post.findMany({
        where: wherePosts,
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.min(500, limit)),
        select: { id: true, userId: true, videoUrl: true, thumbnailUrl: true }
      });
      let assetsUpdated = 0;
      let postsUpdated = 0;
      for (const p of posts) {
        if (!p.videoUrl) continue;
        const asset = await (prisma as any).mediaAsset.findFirst({ where: { userId: p.userId, url: p.videoUrl } });
        if (asset) {
          // If asset has no thumb but post does, copy to asset
          if (!asset.thumbUrl && p.thumbnailUrl) {
            await (prisma as any).mediaAsset.update({ where: { id: asset.id }, data: { thumbUrl: p.thumbnailUrl } });
            assetsUpdated++;
          }
          // If post has no thumbnail but asset does, copy to post
          if (!p.thumbnailUrl && asset.thumbUrl) {
            await prisma.post.update({ where: { id: p.id }, data: { thumbnailUrl: asset.thumbUrl } });
            postsUpdated++;
          }
        }
      }
      return NextResponse.json({ ok: true, mode, assetsUpdated, postsUpdated, examined: posts.length });
    }

    // Special mode: generate thumbnails server-side for posts/assets missing any thumbnail
    if (mode === 'thumbsGenerate') {
      // Check ffmpeg/ffprobe availability
      try { await execAsync('ffmpeg -version'); } catch { return NextResponse.json({ ok: false, error: 'ffmpeg not available on server' }, { status: 400 }); }
      try { await execAsync('ffprobe -version'); } catch { /* proceed without, we can still try ffmpeg */ }

      const wherePosts: any = { videoUrl: { not: null } };
      if (!all) wherePosts.createdAt = { gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
      const posts = await prisma.post.findMany({
        where: wherePosts,
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.min(200, limit)),
        select: { id: true, userId: true, videoUrl: true, thumbnailUrl: true, content: true }
      });

      const bucket = admin.storage().bucket();
      const bucketName: string = (bucket as any).name;

      let generated = 0;
      let updatedPosts = 0;
      let updatedAssets = 0;
      const tempRoot = join(process.cwd(), 'temp_thumbs');
      if (!existsSync(tempRoot)) {
        await mkdir(tempRoot, { recursive: true });
      }

      for (const p of posts) {
        if (!p.videoUrl) continue;
        const asset = await (prisma as any).mediaAsset.findFirst({ where: { userId: p.userId, url: p.videoUrl } });
        const needsPost = !p.thumbnailUrl;
        const needsAsset = !asset?.thumbUrl;
        if (!needsPost && !needsAsset) continue;

        // Generate a single representative frame ~1s into the video
        const stamp = Date.now();
        const tmpPath = join(tempRoot, `thumb_${p.id}_${stamp}.jpg`);
        const inputUrl = p.videoUrl;
        const cmd = `ffmpeg -ss 1.0 -i "${inputUrl}" -frames:v 1 -q:v 2 -y "${tmpPath}"`;
        try {
          await execAsync(cmd);
          if (!existsSync(tmpPath)) continue;
          const buf = await readFile(tmpPath);
          // Upload to Firebase Storage with a download token
          const token = (globalThis as any).crypto?.randomUUID ? crypto.randomUUID() : `${stamp}-${Math.random().toString(36).slice(2)}`;
          const objectPath = `posts/thumbnails/${p.userId}/${p.id}_${stamp}.jpg`;
          const file = bucket.file(objectPath);
          await file.save(buf, {
            contentType: 'image/jpeg',
            metadata: { metadata: { firebaseStorageDownloadTokens: token } },
            resumable: false,
          });
          const encPath = encodeURIComponent(objectPath);
          const thumbUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encPath}?alt=media&token=${encodeURIComponent(token)}`;

          // Update post and asset as needed
          if (needsPost) {
            await prisma.post.update({ where: { id: p.id }, data: { thumbnailUrl: thumbUrl } });
            updatedPosts++;
          }
          if (asset && needsAsset) {
            await (prisma as any).mediaAsset.update({ where: { id: asset.id }, data: { thumbUrl } });
            updatedAssets++;
          }
          generated++;
        } catch (e) {
          // continue to next
        } finally {
          try { await unlink(tmpPath); } catch {}
        }
      }

      return NextResponse.json({ ok: true, mode, generated, updatedPosts, updatedAssets, examined: posts.length, bucket: bucketName });
    }

    // Special mode: backfill gradients for existing posts missing colors
    if (mode === 'gradients') {
      const DEFAULT_FROM = '#0f172a';
      const DEFAULT_VIA = '#1f2937';
      const DEFAULT_TO = '#0f172a';
      const backfillWhere: any = { OR: [
        { gradientFromColor: null },
        { gradientToColor: null },
      ] };
      if (!all) {
        backfillWhere.createdAt = { gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
      }
      const candidates = await prisma.post.findMany({
        where: backfillWhere,
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.min(500, limit)),
        select: { id: true, gradientFromColor: true, gradientViaColor: true, gradientToColor: true },
      });
      let updated = 0;
      for (const p of candidates) {
        await prisma.post.update({
          where: { id: p.id },
          data: {
            gradientDirection: 'to-br',
            gradientFromColor: p.gradientFromColor || DEFAULT_FROM,
            gradientViaColor: p.gradientViaColor || DEFAULT_VIA,
            gradientToColor: p.gradientToColor || DEFAULT_TO,
          }
        });
        updated++;
      }
      const totalMissing = await prisma.post.count({ where: backfillWhere });
      return NextResponse.json({ ok: true, mode, updated, examined: candidates.length, remaining: totalMissing });
    }

    // Find recent completed ingest jobs (any user), then attach results to the current user's Media Library
    // This covers cases where ingests were started while not signed-in or under a different userId.
    const where: any = { status: { in: ['completed', 'success', 'done', 'finished'] } };
    if (!all) where.updatedAt = { gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
    const jobs = await (prisma as any).ingestJob.findMany({
      where,
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    let created = 0;
    for (const job of jobs) {
      const url: string | null = job.videoUrl || job.mediaUrl;
      if (!url) continue;
      const existing = await (prisma as any).mediaAsset.findFirst({ where: { userId, url } });
      if (existing) continue;
      const type: 'video' | 'image' | 'gif' | 'audio' = job.videoUrl ? 'video' : (job.mediaUrl?.match(/\.gif($|\?)/i) ? 'gif' : 'image');
      await createMedia({
        userId,
        type,
        url,
        thumbUrl: job.thumbnailUrl,
        title: job.title ?? null,
        durationSec: job.durationSec ?? null,
        width: job.width ?? null,
        height: job.height ?? null,
        source: 'external',
        // CF fields removed in Firebase-only plan
      });
      created += 1;
    }

    const total = await (prisma as any).ingestJob.count({ where });
    return NextResponse.json({ created, examined: jobs.length, total, hours, all });
  } catch (e: any) {
    console.error('[api/media/backfill] failed:', e?.message || e);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}

// Allow GET to trigger the same logic (browser-friendly)
export async function GET(request: Request, _ctx: { params: Promise<{}> }) {
  return POST(request, _ctx);
}
