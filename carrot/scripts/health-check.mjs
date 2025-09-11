// scripts/health-check.mjs (carrot/scripts)
import { PrismaClient } from '@prisma/client';

const run = async () => {
  const prisma = new PrismaClient();
  try {
    // Simple connectivity check
    const ping = await prisma.$queryRawUnsafe('select 1 as ok');
    const ok = Array.isArray(ping) && ping[0]?.ok === 1;
    if (!ok) throw new Error('Ping failed');

    // Count successful migrations (support different Prisma versions)
    let rows;
    try {
      // Newer Prisma (some setups had a boolean success)
      rows = await prisma.$queryRawUnsafe('select count(*)::int as ok from _prisma_migrations where success = true');
    } catch (_e1) {
      try {
        // Prisma with status column
        rows = await prisma.$queryRawUnsafe("select count(*)::int as ok from _prisma_migrations where status = 'MigrationSuccess'");
      } catch (_e2) {
        // Fallback: finished_at non-null and not rolled back
        rows = await prisma.$queryRawUnsafe('select count(*)::int as ok from _prisma_migrations where finished_at is not null and rolled_back_at is null');
      }
    }
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
