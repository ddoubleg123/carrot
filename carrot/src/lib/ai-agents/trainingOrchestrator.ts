import { TrainingStore } from './trainingStore'
import type { TrainingPlan, TrainingTask } from './trainingPlanTypes'
import { AgentSpecificRetriever } from './agentSpecificRetriever'

let started = false
// Per-plan pacing memory (not persisted)
const lastRunAt = new Map<string, number>()
const GLOBAL_MAX_TASKS_PER_TICK = Math.max(1, parseInt(process.env.TRAIN_GLOBAL_MAX_TASKS_PER_TICK || '2', 10) || 2)

async function processTask(task: TrainingTask, plan: TrainingPlan) {
  // Skip if plan paused/canceled
  if (plan.status === 'paused' || plan.status === 'canceled' || plan.status === 'failed') return
  // Mark running
  task.status = 'running'
  task.attempts += 1
  task.updatedAt = new Date().toISOString()
  TrainingStore.updateTask(task)

  try {
    const topic = task.topic
    const perTopicMax = plan.options.perTopicMax
    // Compute how many already fed for this topic across tasks
    const tasks = TrainingStore.listTasks(plan.id).filter(t => t.topic === topic)
    const fedSoFar = tasks.reduce((a,b)=> a + (b.itemsFed||0), 0)
    const remaining = Math.max(0, perTopicMax - fedSoFar)
    if (remaining <= 0) {
      task.status = 'skipped'
      task.updatedAt = new Date().toISOString()
      TrainingStore.updateTask(task)
      return
    }

    // Page size per tick (slightly larger to improve throughput but still safe)
    const pageSize = Math.min(16, remaining)
    const res = await AgentSpecificRetriever.retrieveForTopic({
      agentId: plan.agentId,
      topic,
      maxResults: pageSize,
      autoFeed: true,
      sourceTypes: plan.options.sourceTypes,
      verificationMode: plan.options.verificationMode || (plan.options.verifyWithDeepseek ? 'strict' : 'off'),
      verifyWithDeepseek: !!plan.options.verifyWithDeepseek,
    })

    task.itemsFed = res.fedCount
    task.status = 'done'
    task.updatedAt = new Date().toISOString()
    TrainingStore.updateTask(task)

    // Enqueue next page if still under cap
    const newFedTotal = fedSoFar + res.fedCount
    if (newFedTotal < perTopicMax && res.success && res.results.length > 0) {
      const nextPage = (task.page || 1) + 1
      TrainingStore.enqueueNextPage(plan.id, topic, nextPage)
    }
  } catch (e: any) {
    task.lastError = String(e?.message || e)
    task.status = 'failed'
    task.updatedAt = new Date().toISOString()
    TrainingStore.updateTask(task)
  }
}

function recomputeTotals(plan: TrainingPlan) {
  const tasks = TrainingStore.listTasks(plan.id)
  plan.totals = {
    queued: tasks.filter(t=> t.status==='queued').length,
    running: tasks.filter(t=> t.status==='running').length,
    done: tasks.filter(t=> t.status==='done').length,
    failed: tasks.filter(t=> t.status==='failed').length,
    skipped: tasks.filter(t=> t.status==='skipped').length,
    dropped: tasks.reduce((a,b)=> a + (b.itemsDropped||0), 0),
    fed: tasks.reduce((a,b)=> a + (b.itemsFed||0), 0),
  }
  plan.updatedAt = new Date().toISOString()
  // If all finished and none queued/running, mark completed
  if (plan.totals.queued===0 && plan.totals.running===0) {
    const anyOpen = tasks.some(t=> t.status==='queued' || t.status==='running')
    if (!anyOpen) {
      plan.status = 'completed'
    }
  }
  TrainingStore.updatePlan(plan)
}

async function tick() {
  // Scan all plans and run a few tasks FIFO
  const planIds = TrainingStore.listPlanIds()
  const plans: TrainingPlan[] = planIds.map(id=> TrainingStore.getPlan(id)).filter((p): p is TrainingPlan => !!p)
  let executed = 0
  for (const plan of plans) {
    if (!plan) continue
    if (plan.status === 'pending') { plan.status = 'running'; TrainingStore.updatePlan(plan) }
    if (plan.status !== 'running') { continue }

    // Pacing knobs per plan
    const throttleMs = typeof plan.options.throttleMs === 'number' ? Math.max(0, plan.options.throttleMs) : 4000
    const maxTasksPerTick = Math.max(1, plan.options.maxTasksPerTick || 1)

    const now = Date.now()
    const last = lastRunAt.get(plan.id) || 0
    if (now - last < throttleMs) continue

    const tasks = TrainingStore.listTasks(plan.id)
    const queued = tasks.filter(t=> t.status==='queued')

    const budget = Math.min(maxTasksPerTick, queued.length, Math.max(0, GLOBAL_MAX_TASKS_PER_TICK - executed))
    for (let i = 0; i < budget; i++) {
      const next = queued[i]
      if (!next) break
      await processTask(next, plan)
      executed++
      if (executed >= GLOBAL_MAX_TASKS_PER_TICK) break
    }
    if (budget > 0) {
      lastRunAt.set(plan.id, now + Math.floor(Math.random()*500)) // small jitter
      recomputeTotals(plan)
    }
    if (executed >= GLOBAL_MAX_TASKS_PER_TICK) break
  }
}

export function startTrainingOrchestrator() {
  if (started) return
  started = true
  // Lightweight interval runner
  setInterval(() => { tick().catch(()=>{}) }, 1500)
}
