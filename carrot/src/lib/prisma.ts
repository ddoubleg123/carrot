import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

function resolveSqliteUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith('file:')) return url;
  const p = url.slice('file:'.length);
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  let candidate = abs;
  // If the resolved file doesn't exist, try a fallback from "carrot/prisma" to "prisma"
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
}

const resolvedDbUrl = resolveSqliteUrl(process.env.DATABASE_URL);
try {
  const raw = process.env.DATABASE_URL;
  let filePath: string | null = null;
  if (resolvedDbUrl?.startsWith('file:')) {
    filePath = resolvedDbUrl.slice('file:'.length);
  } else if (raw?.startsWith('file:')) {
    // Fallback to raw for logging clarity
    const p = raw.slice('file:'.length);
    const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    const alt = abs.replace(new RegExp(`${path.sep}carrot${path.sep}prisma${path.sep}`), `${path.sep}prisma${path.sep}`);
    filePath = fs.existsSync(abs) ? abs : (fs.existsSync(alt) ? alt : abs);
  }
  console.log('[Prisma] CWD:', process.cwd());
  console.log('[Prisma] DATABASE_URL (raw):', raw);
  console.log('[Prisma] DATABASE_URL (resolved):', resolvedDbUrl);
  if (filePath) {
    console.log('[Prisma] SQLite filePath:', filePath);
    console.log('[Prisma] SQLite dir exists:', fs.existsSync(path.dirname(filePath)));
    console.log('[Prisma] SQLite file exists:', fs.existsSync(filePath));
  }
} catch (e) {
  console.warn('[Prisma] Failed logging DB diagnostics:', e);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    ...(resolvedDbUrl ? { datasources: { db: { url: resolvedDbUrl } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
