#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const env = process.env.NODE_ENV || 'production';
const isProd = env === 'production' || process.env.RENDER === 'true';

const mode = process.argv[2];

const DANGER_CMDS = [/prisma\s+db\s+push/i, /prisma\s+migrate\s+reset/i, /prisma\s+migrate\s+dev/i];
const DESTRUCTIVE_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TABLE\b.*\bDROP\b/i,
  /\bRENAME\s+COLUMN\b/i,
];

function fail(msg) { console.error(`❌ ${msg}`); process.exit(1); }
function ok(msg) { console.log(`✅ ${msg}`); }

function checkScripts() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const scripts = Object.values(pkg.scripts || {}).join('\n');
  const bad = DANGER_CMDS.filter(rx => rx.test(scripts));
  if (bad.length) {
    fail(`Forbidden prisma CLI in package.json scripts: ${bad.map(r=>r.source).join(', ')}.\nAdd a dev-only script gated by NODE_ENV=development or remove entirely.`);
  }
  ok('package.json scripts are safe');
}

function lintMigrations() {
  const migDir = path.join(ROOT, 'prisma', 'migrations');
  if (!fs.existsSync(migDir)) return ok('No migrations dir — skipped');

  const allowPath = path.join(ROOT, '.allow-destructive');
  const allowExists = fs.existsSync(allowPath);
  const offenders = [];

  for (const dir of fs.readdirSync(migDir)) {
    const sqlPath = path.join(migDir, dir, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;
    const sql = fs.readFileSync(sqlPath, 'utf8');
    if (DESTRUCTIVE_PATTERNS.some(rx => rx.test(sql))) offenders.push(sqlPath);
  }

  if (offenders.length) {
    if (!allowExists) {
      fail(`Destructive SQL found:\n- ${offenders.join('\n- ')}\nCreate .allow-destructive with rationale, env, date, and approver, and add PR label "destructive-migration".`);
    } else {
      const allow = fs.readFileSync(allowPath, 'utf8');
      if (!/WARNING/i.test(allow) || !/Approved\s*by:/i.test(allow)) {
        fail(`.allow-destructive missing "WARNING" line and "Approved by:" line.`);
      }
      ok(`Destructive SQL allowed by .allow-destructive:\n- ${offenders.join('\n- ')}`);
    }
  } else {
    ok('No destructive SQL found');
  }
}

function deploy() {
  // Block dangerous commands in prod by argv content
  const argv = process.argv.slice(2).join(' ');
  const forbidden = ['migrate reset', 'migrate dev', 'db push'];
  if (isProd && forbidden.some(f => argv.includes(f))) {
    fail(`Forbidden Prisma command in prod: ${argv}`);
  }
  const dbUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) fail('No DB URL for migrations');
  if (isProd && !/carrot_admin/i.test(dbUrl)) {
    fail('Prod migration must use admin role via MIGRATION_DATABASE_URL');
  }
  execSync(`DATABASE_URL="${dbUrl}" npx prisma migrate deploy`, { stdio: 'inherit', shell: true });
}

switch (mode) {
  case 'check-scripts':
    checkScripts();
    break;
  case 'lint-migrations':
    lintMigrations();
    break;
  case 'deploy':
    deploy();
    break;
  default:
    fail('Usage: node scripts/prisma-guard.cjs [check-scripts|lint-migrations|deploy]');
}
