// scripts/health-check.mjs (carrot/scripts)
import { PrismaClient } from '@prisma/client';

const run = async () => {
  const prisma = new PrismaClient();
  try {
    // Simple connectivity check
    const ping = await prisma.$queryRawUnsafe('select 1 as ok');
    const ok = Array.isArray(ping) && ping[0]?.ok === 1;
    if (!ok) throw new Error('Ping failed');

    // Count successful migrations
    const rows = await prisma.$queryRawUnsafe('select count(*)::int as ok from _prisma_migrations where success = true');
    const migOk = Array.isArray(rows) && Number.isInteger(rows[0]?.ok);
    if (!migOk) throw new Error('Migration table check failed');

    console.log('✅ DB health OK · migrations:', rows[0].ok);
  } catch (err) {
    console.error('❌ DB health FAILED:', err?.message ?? err);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch {}
  }
};

run();
