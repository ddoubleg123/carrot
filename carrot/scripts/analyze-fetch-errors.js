const fs = require('fs');
const runId = process.argv[2];
const auditFile = process.argv[3] || 'bulls.audit-complete.json';
const data = JSON.parse(fs.readFileSync(auditFile, 'utf8').replace(/^\uFEFF/, ''));
const runs = new Set();
data.items.forEach(i => i.runId && runs.add(i.runId));
const targetRunId = runId || Array.from(runs).sort().pop();
const items = data.items.filter(i => i.runId === targetRunId);

const fetchEvents = items.filter(i => i.step === 'fetch');
const fetchFailures = fetchEvents.filter(i => i.status === 'fail');
const fetchSuccess = fetchEvents.filter(i => i.status === 'ok');

console.log(`Run: ${targetRunId}`);
console.log(`Total fetch attempts: ${fetchEvents.length}`);
console.log(`Successful fetches: ${fetchSuccess.length}`);
console.log(`Failed fetches: ${fetchFailures.length}\n`);

if (fetchFailures.length > 0) {
  console.log('Fetch failure reasons:');
  const reasons = new Map();
  fetchFailures.forEach(f => {
    const reason = f.error?.message || f.decisions?.reason || 'unknown';
    reasons.set(reason, (reasons.get(reason) || 0) + 1);
  });
  Array.from(reasons.entries()).forEach(([reason, count]) => {
    console.log(`  ${reason}: ${count}`);
  });
  
  console.log('\nFailed fetch URLs:');
  fetchFailures.forEach(f => {
    console.log(`  ${f.candidateUrl || f.finalUrl || 'unknown'}: ${f.error?.message || f.decisions?.reason || 'unknown'}`);
  });
}

if (fetchSuccess.length > 0) {
  console.log('\nSuccessful fetches (should proceed to synthesis):');
  fetchSuccess.forEach(f => {
    console.log(`  ${f.candidateUrl || f.finalUrl || 'unknown'}`);
  });
}

const synthesisEvents = items.filter(i => i.step === 'synthesis');
console.log(`\nSynthesis events: ${synthesisEvents.length}`);
if (synthesisEvents.length > 0) {
  synthesisEvents.forEach(s => {
    console.log(`  ${s.status}: ${s.candidateUrl || s.finalUrl || 'unknown'}`);
  });
}

const saves = items.filter(i => i.step === 'save' && i.status === 'ok');
console.log(`\nSaves: ${saves.length}`);

