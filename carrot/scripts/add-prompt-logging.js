const fs = require('fs');
const path = require('path');
function patchFile(fp, kind) {
  if (!fs.existsSync(fp)) return console.warn(`[skip] ${fp} not found`);
  let src = fs.readFileSync(fp, 'utf8');
  const tag = kind === 'vetter' ? '[DISCOVERY_V2][VETTER_PROMPT]' : '[DISCOVERY_V2][PLANNER_PROMPT]';
  if (src.includes(tag)) return console.log(`[ok] already instrumented: ${fp}`);
  if (!src.includes("from 'node:crypto'") && !src.includes('from "node:crypto"')) {
    const importIdx = src.indexOf('import ');
    if (importIdx !== -1) {
      const firstSemi = src.indexOf('\n', importIdx);
      src = src.slice(0, firstSemi + 1) + "import { createHash } from 'node:crypto';\n" + src.slice(firstSemi + 1);
    } else {
      src = "import { createHash } from 'node:crypto';\n" + src;
    }
  }
  const sysVar = kind === 'vetter' ? 'VETTER_SYSTEM_PROMPT' : 'SYSTEM_PROMPT';
  let lines = src.split('\n');
  let insertAt = -1;
  let userVarName = 'userPrompt';
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/const\s+([A-Za-z0-9_]+)\s*=\s*buildUserPrompt\s*\(/);
    if (m) {
      userVarName = m[1];
      insertAt = i + 1;
      break;
    }
  }
  if (insertAt === -1) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/(let|var)\s+([A-Za-z0-9_]+)\s*=\s*buildUserPrompt\s*\(/);
      if (m) {
        userVarName = m[2];
        insertAt = i + 1;
        break;
      }
    }
  }
  if (insertAt === -1) {
    console.warn(`[warn] could not locate buildUserPrompt(...) assignment in ${fp}; no changes made`);
    return;
  }
  const tagLiteral = kind === 'vetter' ? '[DISCOVERY_V2][VETTER_PROMPT]' : '[DISCOVERY_V2][PLANNER_PROMPT]';
  const oneLiner = `console.info(\`${tagLiteral} patch=\${typeof patchId!=='undefined'?patchId:'(n/a)'} sysHash=\${createHash('sha256').update(${sysVar}).digest('hex')} userHash=\${createHash('sha256').update(${userVarName}).digest('hex')} sysHead="\${${sysVar}.slice(0,120).replace(/\\s+/g,' ')}" userHead="\${${userVarName}.slice(0,120).replace(/\\s+/g,' ')}"\`);`;
  lines.splice(insertAt, 0, oneLiner);
  fs.writeFileSync(fp, lines.join('\n'), 'utf8');
  console.log(`[ok] instrumented: ${fp}`);
}
patchFile(path.resolve('src/lib/discovery/vetter.ts'), 'vetter');
patchFile(path.resolve('src/lib/discovery/planner.ts'), 'planner');
