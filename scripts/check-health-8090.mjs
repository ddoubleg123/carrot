// Usage: node scripts/check-health-8090.mjs
import fs from 'fs/promises';

const URL = process.env.URL || 'http://localhost:8090/health';
const OUT = process.env.OUT || './health8090.json';

async function main(){
  const out = { ok:false, status: null, body:null, error:null };
  try {
    const res = await fetch(URL);
    out.status = res.status;
    out.ok = res.ok;
    out.body = await res.text();
  } catch (e) {
    out.error = e?.message || String(e);
  } finally {
    await fs.writeFile(OUT, JSON.stringify(out, null, 2));
    console.log(`Wrote ${OUT}`);
  }
}

main();
