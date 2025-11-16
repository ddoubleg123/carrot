const fs = require('fs');
const runId = process.argv[2];
const auditFile = process.argv[3] || 'bulls.audit-final.json';
const data = JSON.parse(fs.readFileSync(auditFile, 'utf8').replace(/^\uFEFF/, ''));
const runs = new Set();
data.items.forEach(i => i.runId && runs.add(i.runId));
const targetRunId = runId || Array.from(runs).sort().pop();
const items = data.items.filter(i => i.runId === targetRunId);
const steps = new Map();
items.forEach(i => {
  const step = i.step;
  steps.set(step, (steps.get(step) || 0) + 1);
});
console.log('Steps in run:', Object.fromEntries(steps.entries()));

const saves = items.filter(i => i.step === 'save' && i.status === 'ok');
const vetterFailures = items.filter(i => i.step === 'synthesis' && i.status === 'fail');
const fetchFailures = items.filter(i => i.step === 'fetch' && i.status === 'fail');

console.log('\nSaves:', saves.length);
console.log('Vetter failures:', vetterFailures.length);
console.log('Fetch failures:', fetchFailures.length);

if (vetterFailures.length > 0) {
  console.log('\nFirst vetter failure:', JSON.stringify(vetterFailures[0].error || vetterFailures[0].decisions, null, 2));
}

