import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import type { TrainingPlan, TrainingTask, TrainingPlanTotals, TrainingPlanOptions, DiscoveryEntry, DiscoveryStatus } from './trainingPlanTypes'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
// Lax alias to avoid TS errors if client hasn't generated new model typings yet
const dbClient: any = prisma as any

// Prefer explicit env path; otherwise use a repo-local folder for durability instead of OS tmp
const DIR = process.env.CARROT_DATA_DIR || join(process.cwd(), '.carrot-data', 'training')
const FILE = join(DIR, 'plans.json')

type DB = {
  plans: Record<string, TrainingPlan>
  tasks: Record<string, TrainingTask>
  discoveries: Record<string, DiscoveryEntry[]> // planId -> entries
}

function ensure() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
  if (!existsSync(FILE)) {
    const empty: DB = { plans: {}, tasks: {}, discoveries: {} }
    writeFileSync(FILE, JSON.stringify(empty))
  }
}

function load(): DB {
  ensure()
  try {
    const txt = readFileSync(FILE, 'utf8')
    return JSON.parse(txt)
  } catch {
    return { plans: {}, tasks: {}, discoveries: {} }
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
    db.discoveries[id] = []
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
    // Write-through to Prisma (best-effort, append-only)
    ;(async()=>{
      try {
        if (dbClient.trainingPlan?.create) await dbClient.trainingPlan.create({
          data: {
            id,
            agentId,
            topics: JSON.stringify(topics),
            options: JSON.stringify(options),
            status: plan.status,
            totals: JSON.stringify(totals),
            topicPages: JSON.stringify(plan.topicPages),
          }
        })
        if (topics.length) {
          const taskRows = Object.values(db.tasks).filter(t=> t.planId===id).map(t=> ({
            id: t.id,
            planId: t.planId,
            agentId: t.agentId,
            topic: t.topic,
            page: t.page || 1,
            status: t.status,
            itemsFed: t.itemsFed||0,
            itemsDropped: t.itemsDropped||0,
            attempts: t.attempts||0,
            lastError: t.lastError || null as any,
          }))
          if (taskRows.length) {
            if (dbClient.trainingTask?.createMany) await dbClient.trainingTask.createMany({ data: taskRows, skipDuplicates: true })
          }
        }
      } catch {}
    })()
    return plan
  },
  appendDiscoveries(planId: string, entries: Array<{ topic: string; page: number; url?: string; title?: string; sourceType?: string; status?: DiscoveryStatus; id?: string; ts?: string }>) {
    const db = load()
    const list = db.discoveries[planId] || []
    const now = new Date().toISOString()
    for (const e of entries) {
      list.push({
        id: e.id || randomUUID(),
        planId,
        topic: e.topic,
        page: e.page,
        url: e.url,
        title: e.title,
        sourceType: (e as any).sourceType,
        status: (e.status as DiscoveryStatus) || 'retrieved',
        ts: e.ts || now,
      })
    }
    db.discoveries[planId] = list
    save(db)
    // Write-through to Prisma
    ;(async()=>{
      try {
        const data = entries.map(e=> ({
          id: e.id || randomUUID(),
          planId,
          topic: e.topic,
          page: e.page,
          url: e.url || null as any,
          title: e.title || null as any,
          sourceType: (e as any).sourceType || null as any,
          status: (e.status as any) || 'retrieved',
          ts: new Date(e.ts || new Date().toISOString()),
        }))
        if (dbClient.discoveryEntry?.createMany) await dbClient.discoveryEntry.createMany({ data, skipDuplicates: true })
      } catch {}
    })()
  },
  updateDiscoveryStatus(planId: string, ids: string[], status: DiscoveryStatus) {
    const db = load()
    const list = db.discoveries[planId]
    if (!list) return
    const now = new Date().toISOString()
    for (const id of ids) {
      const idx = list.findIndex(x => x.id === id)
      if (idx >= 0) { list[idx].status = status; list[idx].ts = now }
    }
    db.discoveries[planId] = list
    save(db)
    ;(async()=>{ try { if (dbClient.discoveryEntry?.updateMany) await dbClient.discoveryEntry.updateMany({ where: { id: { in: ids } }, data: { status } }) } catch {} })()
  },
  listDiscoveries(planId: string, opts?: { topic?: string; status?: DiscoveryStatus; limit?: number }) {
    const db = load()
    let arr = (db.discoveries[planId] || []).slice().reverse() // newest first
    if (opts?.topic) arr = arr.filter(x => x.topic === opts.topic)
    if (opts?.status) arr = arr.filter(x => x.status === opts.status)
    if (opts?.limit) arr = arr.slice(0, Math.max(1, opts.limit))
    return arr
  },
  getPlan(planId: string): TrainingPlan | null {
    const db = load()
    return db.plans[planId] || null
  },
  listPlanIds(): string[] {
    const db = load()
    return Object.keys(db.plans)
  },
  listTasks(planId: string): TrainingTask[] {
    const db = load()
    return Object.values(db.tasks).filter((t: TrainingTask) => t.planId === planId).sort((a: TrainingTask, b: TrainingTask)=> a.createdAt.localeCompare(b.createdAt))
  },
  updatePlan(plan: TrainingPlan) {
    const db = load()
    plan.updatedAt = new Date().toISOString()
    db.plans[plan.id] = plan
    save(db)
    ;(async()=>{
      try {
        if (dbClient.trainingPlan?.upsert) await dbClient.trainingPlan.upsert({
          where: { id: plan.id },
          create: {
            id: plan.id,
            agentId: plan.agentId,
            topics: JSON.stringify(plan.topics),
            options: JSON.stringify(plan.options),
            status: plan.status,
            totals: JSON.stringify(plan.totals),
            topicPages: JSON.stringify(plan.topicPages),
          },
          update: {
            agentId: plan.agentId,
            topics: JSON.stringify(plan.topics),
            options: JSON.stringify(plan.options),
            status: plan.status,
            totals: JSON.stringify(plan.totals),
            topicPages: JSON.stringify(plan.topicPages),
          }
        })
      } catch {}
    })()
  },
  updateTask(task: TrainingTask) {
    const db = load()
    save(db)
    ;(async()=>{
      try {
        if (dbClient.trainingTask?.upsert) await dbClient.trainingTask.upsert({
          where: { id: task.id },
          create: {
            id: task.id,
            planId: task.planId,
            agentId: task.agentId,
            topic: task.topic,
            page: task.page || 1,
            status: task.status,
            itemsFed: task.itemsFed || 0,
            itemsDropped: task.itemsDropped || 0,
            attempts: task.attempts || 0,
            lastError: task.lastError || null as any,
          },
          update: {
            status: task.status,
            itemsFed: task.itemsFed || 0,
            itemsDropped: task.itemsDropped || 0,
            attempts: task.attempts || 0,
            lastError: task.lastError || null as any,
            page: task.page || 1,
          }
        })
      } catch {}
    })()
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
    ;(async()=>{
      try {
        if (dbClient.trainingTask?.create) await dbClient.trainingTask.create({
          data: {
            id: taskId,
            planId,
            agentId: plan.agentId,
            topic,
            page: nextPage,
            status: 'queued',
            itemsFed: 0,
            itemsDropped: 0,
            attempts: 0,
          }
        })
        if (dbClient.trainingPlan?.update) await dbClient.trainingPlan.update({
          where: { id: planId },
          data: {
            totals: JSON.stringify(plan.totals),
            topicPages: JSON.stringify(plan.topicPages),
            status: plan.status,
          }
        })
      } catch {}
    })()
  }
}
