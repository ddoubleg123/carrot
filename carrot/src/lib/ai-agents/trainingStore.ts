import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import type { TrainingPlan, TrainingTask, TrainingPlanTotals, TrainingPlanOptions } from './trainingPlanTypes'

const DIR = process.env.CARROT_DATA_DIR || join(tmpdir(), 'carrot-training')
const FILE = join(DIR, 'plans.json')

type DB = {
  plans: Record<string, TrainingPlan>
  tasks: Record<string, TrainingTask>
}

function ensure() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
  if (!existsSync(FILE)) {
    const empty: DB = { plans: {}, tasks: {} }
    writeFileSync(FILE, JSON.stringify(empty))
  }
}

function load(): DB {
  ensure()
  try {
    const txt = readFileSync(FILE, 'utf8')
    return JSON.parse(txt)
  } catch {
    return { plans: {}, tasks: {} }
  }
}

function save(db: DB) {
  try { writeFileSync(FILE, JSON.stringify(db)) } catch {}
}

export const TrainingStore = {
  createPlan(agentId: string, topics: string[], perTopicMaxOrOptions: number | Partial<TrainingPlanOptions>, sourceTypesMaybe?: string[]): TrainingPlan {
    const db = load()
    const id = randomUUID()
    const now = new Date().toISOString()
    const totals: TrainingPlanTotals = { queued: 0, running: 0, done: 0, failed: 0, skipped: 0, dropped: 0, fed: 0 }
    // Back-compat: support old signature (perTopicMax: number, sourceTypes: string[])
    let options: TrainingPlanOptions
    if (typeof perTopicMaxOrOptions === 'number') {
      options = { perTopicMax: perTopicMaxOrOptions, sourceTypes: sourceTypesMaybe || ['wikipedia','arxiv','academic','books','news','github','stackoverflow','pubmed'] }
    } else {
      const o = perTopicMaxOrOptions || {}
      options = {
        perTopicMax: o.perTopicMax ?? 200,
        sourceTypes: o.sourceTypes ?? ['wikipedia','arxiv','academic','books','news','github','stackoverflow','pubmed'],
        throttleMs: o.throttleMs,
        maxTasksPerTick: o.maxTasksPerTick,
        verifyWithDeepseek: o.verifyWithDeepseek,
      }
    }
    const plan: TrainingPlan = {
      id, agentId, topics,
      options,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      totals,
      topicPages: Object.fromEntries(topics.map(t => [t, 1])),
    }
    db.plans[id] = plan
    // seed initial task per topic (page 1)
    for (const topic of topics) {
      const taskId = randomUUID()
      db.tasks[taskId] = {
        id: taskId, planId: id, agentId, topic, page: 1, status: 'queued',
        itemsFed: 0, itemsDropped: 0, attempts: 0, createdAt: now, updatedAt: now,
      }
      plan.totals.queued++
    }
    save(db)
    return plan
  },
  getPlan(planId: string): TrainingPlan | null {
    const db = load()
    return db.plans[planId] || null
  },
  listTasks(planId: string): TrainingTask[] {
    const db = load()
    return Object.values(db.tasks).filter(t => t.planId === planId).sort((a,b)=> a.createdAt.localeCompare(b.createdAt))
  },
  updatePlan(plan: TrainingPlan) {
    const db = load()
    db.plans[plan.id] = plan
    save(db)
  },
  updateTask(task: TrainingTask) {
    const db = load()
    db.tasks[task.id] = task
    save(db)
  },
  listPlanIds(): string[] {
    const db = load()
    return Object.keys(db.plans)
  },
  enqueueNextPage(planId: string, topic: string, nextPage: number) {
    const db = load()
    const plan = db.plans[planId]
    if (!plan) return
    const now = new Date().toISOString()
    const taskId = randomUUID()
    db.tasks[taskId] = {
      id: taskId, planId, agentId: plan.agentId, topic, page: nextPage, status: 'queued',
      itemsFed: 0, itemsDropped: 0, attempts: 0, createdAt: now, updatedAt: now,
    }
    plan.totals.queued++
    plan.topicPages[topic] = nextPage
    plan.updatedAt = now
    db.plans[planId] = plan
    save(db)
  }
}
