import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { BatchJob, BatchAgentTask, BatchStatus, BatchStage, TrainingTaskStatus } from '@/lib/ai-agents/trainingPlanTypes';

const STORE_PATH = join(tmpdir(), 'carrot-batch-store.json');

async function readStore(): Promise<Record<string, BatchJob>> {
  try {
    const buf = await fs.readFile(STORE_PATH);
    return JSON.parse(buf.toString());
  } catch {
    return {};
  }
}

async function writeStore(data: Record<string, BatchJob>) {
  try {
    await fs.writeFile(STORE_PATH, JSON.stringify(data));
  } catch {}
}

export async function createBatch(agentIds: string[]): Promise<BatchJob> {
  const store = await readStore();
  const now = new Date().toISOString();
  const id = randomUUID();
  const tasks: BatchAgentTask[] = agentIds.map((agentId) => ({
    id: randomUUID(),
    agentId,
    stage: 'assess',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
  }));
  const job: BatchJob = {
    id,
    agentIds,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    totals: { queued: tasks.length, running: 0, done: 0, failed: 0, discovered: 0, fed: 0 },
    tasks,
    meta: {}
  };
  store[id] = job;
  await writeStore(store);
  return job;
}

export async function getBatch(id: string): Promise<BatchJob | null> {
  const store = await readStore();
  return store[id] || null;
}

export async function updateTask(batchId: string, taskId: string, changes: Partial<BatchAgentTask>): Promise<BatchJob | null> {
  const store = await readStore();
  const job = store[batchId];
  if (!job) return null;
  const idx = job.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  job.tasks[idx] = { ...job.tasks[idx], ...changes, updatedAt: new Date().toISOString() };
  recomputeTotals(job);
  job.updatedAt = new Date().toISOString();
  await writeStore(store);
  return job;
}

export async function setTaskStageStatus(batchId: string, taskId: string, stage: BatchStage, status: TrainingTaskStatus) {
  return updateTask(batchId, taskId, { stage, status });
}

export async function appendDiscovery(batchId: string, taskId: string, countDelta: number) {
  const store = await readStore();
  const job = store[batchId];
  if (!job) return null;
  const idx = job.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  const task = job.tasks[idx];
  task.itemsPlanned = (task.itemsPlanned || 0) + (countDelta || 0);
  job.totals.discovered += (countDelta || 0);
  task.updatedAt = new Date().toISOString();
  job.updatedAt = task.updatedAt;
  await writeStore(store);
  return job;
}

export async function appendFed(batchId: string, taskId: string, fedDelta: number) {
  const store = await readStore();
  const job = store[batchId];
  if (!job) return null;
  const idx = job.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  const task = job.tasks[idx];
  task.itemsFed = (task.itemsFed || 0) + (fedDelta || 0);
  job.totals.fed += (fedDelta || 0);
  task.updatedAt = new Date().toISOString();
  job.updatedAt = task.updatedAt;
  await writeStore(store);
  return job;
}

export async function setBatchStatus(batchId: string, status: BatchStatus) {
  const store = await readStore();
  const job = store[batchId];
  if (!job) return null;
  job.status = status;
  job.updatedAt = new Date().toISOString();
  await writeStore(store);
  return job;
}

function recomputeTotals(job: BatchJob) {
  const totals = { queued: 0, running: 0, done: 0, failed: 0 };
  for (const t of job.tasks) {
    if (t.status in totals) (totals as any)[t.status] += 1;
  }
  job.totals.queued = totals.queued;
  job.totals.running = totals.running;
  job.totals.done = totals.done;
  job.totals.failed = totals.failed;
}
