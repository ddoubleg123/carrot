#!/usr/bin/env node
/*
  One-time backfill: set Post.visualSeed = id and Post.visualStyle = 'liquid'
  - Safe to run multiple times; skips rows that already have either field set
  - Batches updates to avoid long transactions

  Usage (dev):
    node scripts/backfill-post-visuals.js

  Usage (prod via server shell):
    node scripts/backfill-post-visuals.js
*/

const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  const BATCH = 250;
  let total = 0;
  let updated = 0;
  let skipped = 0;

  try {
    total = await prisma.post.count();
    console.log(`[backfill] total posts: ${total}`);

    let cursor = undefined;
    let fetched = 0;

    while (true) {
      const rows = await prisma.post.findMany({
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: { id: true, visualSeed: true, visualStyle: true },
      });
      if (!rows.length) break;
      fetched += rows.length;
      cursor = rows[rows.length - 1].id;

      const todo = rows.filter(r => !r.visualSeed || !r.visualStyle);
      if (!todo.length) { skipped += rows.length; continue; }

      // Update each row independently to set deterministic seed/style
      for (const r of todo) {
        try {
          await prisma.post.update({
            where: { id: r.id },
            data: {
              visualSeed: r.visualSeed || r.id,
              visualStyle: r.visualStyle || 'liquid',
            },
          });
          updated++;
        } catch (e) {
          console.error(`[backfill] failed to update post ${r.id}:`, e?.message || e);
        }
      }

      console.log(`[backfill] processed ${fetched}/${total} … updated so far: ${updated}`);
    }

    console.log(`[backfill] DONE. total=${total} updated=${updated} skippedApprox=${skipped}`);
  } catch (e) {
    console.error('[backfill] fatal error:', e?.message || e);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {}
  }
})();
