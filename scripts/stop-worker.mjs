import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';

const pidPath = resolve(process.cwd(), 'pid_8080.txt');

function isAlive(pid){
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function killWindows(pid){
  return new Promise((resolveP, rejectP) => {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], (err, stdout, stderr) => {
      if (err) return rejectP(err);
      resolveP({ stdout, stderr });
    });
  });
}

async function main(){
  if (!existsSync(pidPath)){
    console.log('No pid file found:', pidPath);
    return;
  }
  const raw = readFileSync(pidPath, 'utf8').trim();
  const pid = Number(raw);
  if (!Number.isFinite(pid) || pid <= 0){
    console.log('Invalid PID in file:', raw);
    return;
  }

  if (!isAlive(pid)){
    console.log(`Process not running (PID ${pid}). Removing pid file.`);
    try { unlinkSync(pidPath); } catch {}
    return;
  }

  console.log('Stopping worker PID', pid);
  try {
    process.kill(pid);
  } catch {}

  // wait briefly
  await new Promise(r => setTimeout(r, 800));

  if (isAlive(pid)){
    if (process.platform === 'win32'){
      try { await killWindows(pid); } catch {}
    } else {
      try { process.kill(pid, 'SIGKILL'); } catch {}
    }
  }

  // final check
  const alive = isAlive(pid);
  if (!alive){
    console.log('Worker stopped. Cleaning pid file.');
    try { unlinkSync(pidPath); } catch {}
  } else {
    console.log('Warning: process still alive:', pid);
  }
}

main().catch(e => {
  console.error('stop-worker error', e?.message || e);
});
