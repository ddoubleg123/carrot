import { TrainingStore } from './trainingStore'
import type { TrainingPlan, TrainingTask } from './trainingPlanTypes'
import { AgentSpecificRetriever } from './agentSpecificRetriever'

let started = false

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

    const pageSize = Math.min(20, remaining) // fetch per page, capped to 20
    const res = await AgentSpecificRetriever.retrieveForTopic({
      agentId: plan.agentId,
      topic,
      maxResults: pageSize,
      autoFeed: true,
      sourceTypes: plan.options.sourceTypes,
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
  for (const plan of plans) {
    if (!plan) continue
    if (plan.status === 'pending') { plan.status = 'running'; TrainingStore.updatePlan(plan) }
    if (plan.status !== 'running') { continue }
    const tasks = TrainingStore.listTasks(plan.id)
    const next = tasks.find(t=> t.status==='queued')
    if (next) {
      await processTask(next, plan)
      recomputeTotals(plan)
    }
  }
}

export function startTrainingOrchestrator() {
  if (started) return
  started = true
  // Lightweight interval runner
  setInterval(() => { tick().catch(()=>{}) }, 1500)
}
