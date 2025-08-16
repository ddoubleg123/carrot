#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const candidates = [
  'node_modules/country-flag-icons/flags/4x3',
  'node_modules/country-flag-icons/flags/1x1',
  'node_modules/country-flag-icons/3x2',
  'node_modules/flag-icons/flags/4x3',
  'node_modules/flag-icons/flags/1x1',
];

const destDir = path.join(projectRoot, 'carrot', 'public', 'flags');
fs.mkdirSync(destDir, { recursive: true });

function copySvgsFrom(srcDir) {
  try {
    const abs = path.join(projectRoot, srcDir);
    if (!fs.existsSync(abs)) return false;
    const files = fs.readdirSync(abs).filter(f => f.toLowerCase().endsWith('.svg'));
    if (!files.length) return false;
    let copied = 0;
    for (const f of files) {
      const src = path.join(abs, f);
      const base = path.basename(f).toLowerCase();
      const dest = path.join(destDir, base);
      // Do not overwrite existing files (keeps custom overrides like ps.svg)
      if (fs.existsSync(dest)) continue;
      fs.copyFileSync(src, dest);
      copied++;
    }
    console.log(`[flags] Copied ${copied} SVGs from ${srcDir} -> ${path.relative(projectRoot, destDir)}`);
    return copied > 0;
  } catch (e) {
    console.warn(`[flags] Failed to copy from ${srcDir}:`, e.message);
    return false;
  }
}

let anyCopied = false;
for (const dir of candidates) {
  const ok = copySvgsFrom(dir);
  anyCopied = anyCopied || ok;
}

if (!anyCopied) {
  console.warn('[flags] No flag sources found. Ensure a flag icon package is installed.');
}

// Ensure Palestine override asset exists (ps.svg). If absent but we have ps in sources, it was copied. If absent, create a lightweight fallback.
const psPath = path.join(destDir, 'ps.svg');
if (!fs.existsSync(psPath)) {
  const simplePS = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18" viewBox="0 0 24 18">
  <rect width="24" height="6" y="0" fill="#000"/>
  <rect width="24" height="6" y="6" fill="#fff"/>
  <rect width="24" height="6" y="12" fill="#007a3d"/>
  <polygon points="0,0 10,9 0,18" fill="#ce1126"/>
</svg>`;
  fs.writeFileSync(psPath, simplePS, 'utf8');
  console.log('[flags] Created fallback ps.svg');
}
