import { NextResponse } from 'next/server';
import { createBatch, setTaskStageStatus, setBatchStatus, getBatch, updateTask } from '@/lib/server/batchStore';
import { AgentRegistry } from '@/lib/ai-agents/agentRegistry';
import { TrainingStore } from '@/lib/ai-agents/trainingStore';
import { startTrainingOrchestrator } from '@/lib/ai-agents/trainingOrchestrator';
import { FEATURED_AGENTS } from '@/lib/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function processAgent(batchId: string, taskId: string, agentId: string) {
  // Stage 1: assess → create a real TrainingPlan using agent expertise
  await setTaskStageStatus(batchId, taskId, 'assess', 'running');
  const agent = await AgentRegistry.getAgentById(agentId);
  // Fallback: featured agent lookup by id or by matching name if ids differ across sources
  const featured = FEATURED_AGENTS.find(a => a.id === agentId) || (agent ? FEATURED_AGENTS.find(f => f.name.toLowerCase() === String((agent as any).name||'').toLowerCase()) : undefined);
  const topics: string[] =
    (Array.isArray(agent?.domainExpertise) && agent!.domainExpertise.length > 0)
      ? agent!.domainExpertise
      : (featured?.domains && featured.domains.length > 0)
        ? featured.domains
        : (agent?.persona ? [agent.persona] : (featured?.personality?.approach ? [featured.personality.approach] : ['general knowledge']));
  const options = {
    perTopicMax: 200,
    sourceTypes: ['wikipedia','arxiv','academic','books','news','github','stackoverflow','pubmed'],
    throttleMs: 4000,
    maxTasksPerTick: 1,
    verifyWithDeepseek: false as boolean,
  };
  const plan = TrainingStore.createPlan(agentId, topics, options, options.sourceTypes);
  await updateTask(batchId, taskId, { planId: plan.id });
  await setTaskStageStatus(batchId, taskId, 'assess', 'done');

  // Stage 2 + 3 are handled by the orchestrator in real time (discovery + feeding)
  await setTaskStageStatus(batchId, taskId, 'discover', 'running');
  await setTaskStageStatus(batchId, taskId, 'feed', 'running');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const agentIds: string[] = Array.isArray(body.agentIds) ? body.agentIds : [];
    if (agentIds.length === 0) {
      return NextResponse.json({ ok: false, message: 'agentIds required' }, { status: 400 });
    }

    const batch = await createBatch(agentIds);

    // Start background processing sequentially: create plans, then orchestrator handles discover+feed
    (async () => {
      try {
        await setBatchStatus(batch.id, 'running');
        for (const task of (await getBatch(batch.id))!.tasks) {
          await processAgent(batch.id, task.id, task.agentId);
        }
        // Start orchestrator once plans exist (idempotent)
        startTrainingOrchestrator();
        // Batch remains running; completion will be inferred by UI from plan statuses
        await setBatchStatus(batch.id, 'running');
      } catch (e) {
        await setBatchStatus(batch.id, 'failed');
      }
    })();

    return NextResponse.json({ ok: true, batch });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 });
  }
}
