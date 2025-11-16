const fs = require('fs');
const file = process.argv[2] || 'bulls.audit-running.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const runs = new Set();
data.items.forEach(i => i.runId && runs.add(i.runId));
const latestRun = Array.from(runs).sort().pop();
const items = data.items.filter(i => i.runId === latestRun);
const saves = items.filter(i => i.step === 'save' && i.status === 'ok');
const synthesis = items.filter(i => i.step === 'synthesis');
const runComplete = items.find(i => i.step === 'run_complete');
const errors = items.filter(i => i.error);

console.log(JSON.stringify({
  latestRun,
  startedAt: items[0]?.ts || null,
  completed: !!runComplete,
  completedAt: runComplete?.ts || null,
  saves: saves.length,
  synthesis: synthesis.length,
  errors: errors.length,
  lastStep: items[items.length - 1]?.step || null,
  totalItems: items.length
}, null, 2));

if (saves.length > 0) {
  console.log('\nFirst save:', JSON.stringify(saves[0], null, 2));
}

if (errors.length > 0 && errors.length <= 5) {
  console.log('\nRecent errors:');
  errors.slice(-5).forEach(e => {
    console.log(`- ${e.step}: ${e.error?.message || JSON.stringify(e.error)}`);
  });
}

