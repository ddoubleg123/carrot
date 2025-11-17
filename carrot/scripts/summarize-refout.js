const fs = require('fs');
function hostFromUrl(u){try{return new URL(u).hostname.toLowerCase()}catch{return null}}
function load(path){return JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/, ''))}
function main(){
  const file = process.argv[2] || 'bulls.audit-dls.json';
  const data = load(file);
  const items = Array.isArray(data.items) ? data.items : [];
  const runs = Array.from(new Set(items.map(i=>i.runId).filter(Boolean))).sort();
  const latest = runs[runs.length-1];
  const runItems = items.filter(i=>i.runId===latest);
  const frontier = runItems.filter(i=>i.step==='frontier_pop');
  const first20 = frontier.slice(0,20);
  const first20Hosts = first20.map(i=>hostFromUrl(i.candidateUrl||i.meta?.finalUrl||'')).filter(Boolean);
  const distinctHosts = Array.from(new Set(first20Hosts)).length;
  const enqEvents = runItems.filter(i=>i.step==='ref_out_expand' && i.status==='ok');
  const refOutEnqueued = enqEvents.reduce((s,i)=>s+((i.meta&&Array.isArray(i.meta.enqueued)?i.meta.enqueued.length:0)),0);
  const saves = runItems.filter(i=>i.step==='save' && i.status==='ok');
  const firstSaveIndex = saves.length ? runItems.findIndex(i=>i.id===saves[0].id) + 1 : null;
  const payBranches = runItems.filter(i=>i.step && (i.step==='paywall_branch_attempt'||i.step==='paywall_branch_used')).length;
  console.log(JSON.stringify({latest, attempts: frontier.length, refOutEnqueued, distinctFirst20Hosts: distinctHosts, ttfAttempts: firstSaveIndex, paywallLogs: payBranches}, null, 2));
}
main();


