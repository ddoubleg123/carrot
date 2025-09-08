const path = require('path');

function resolveSqlitePath(projectDir) {
  // Prefer env var DATABASE_URL, else default to file:./prisma/dev.db within carrot/
  const envUrl = process.env.DATABASE_URL || '';
  if (envUrl.startsWith('file:')) {
    const p = envUrl.slice('file:'.length);
    return path.isAbsolute(p) ? p : path.resolve(projectDir, p);
  }
  // Fallbacks: try carrot/prisma/dev.db then prisma/dev.db
  const candidate1 = path.resolve(projectDir, 'prisma', 'dev.db');
  return candidate1;
}

module.exports = { resolveSqlitePath };
