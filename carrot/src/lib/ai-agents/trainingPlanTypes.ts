export type TrainingPlanStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled';
export type TrainingTaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'skipped';

// Optional topic graph and mastery tracking
export type MasteryLevel = 'none' | 'novice' | 'intermediate' | 'proficient' | 'expert';

export interface TopicNode {
  id: string;
  title: string;
  parentId?: string | null;
  tags?: string[];
  dependencies?: string[]; // other topic ids
  difficulty?: 'easy' | 'medium' | 'hard';
  priority?: number; // smaller = higher priority
}

export interface MasteryState {
  topicId: string;
  level: MasteryLevel;
  confidence?: number; // 0..1
  evidence?: {
    memoryIds?: string[];
    sources?: string[];
  };
  lastUpdated: string;
}

export interface TrainingPlanOptions {
  perTopicMax: number; // default 200
  sourceTypes: string[];
  // Pacing controls
  throttleMs?: number; // minimum delay between batches per plan
  maxTasksPerTick?: number; // cap tasks processed per tick for this plan
  verifyWithDeepseek?: boolean; // verify sources with Deepseek before feeding
  verificationMode?: 'off' | 'advisory' | 'strict'; // off: skip, advisory: do not block, strict: block unapproved
}

export interface TrainingTask {
  id: string;
  planId: string;
  agentId: string;
  topic: string;
  page: number; // 1-based pagination
  status: TrainingTaskStatus;
  itemsFed: number;
  itemsDropped: number;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingPlanTotals {
  queued: number;
  running: number;
  done: number;
  failed: number;
  skipped: number;
  dropped: number; // aggregate dropped by filter
  fed: number;     // aggregate items fed
}

export interface TrainingPlan {
  id: string;
  agentId: string;
  // Back-compat: allow either string topics or structured nodes
  topics: string[];
  topicGraph?: TopicNode[];
  targets?: Record<string, MasteryLevel>; // topicId -> target mastery
  mastery?: Record<string, MasteryState>; // topicId -> mastery state
  options: TrainingPlanOptions;
  status: TrainingPlanStatus;
  createdAt: string;
  updatedAt: string;
  totals: TrainingPlanTotals;
  // internal cursor per topic (next page)
  topicPages: Record<string, number>;
}

export type ProgressEventType = 'retrieved' | 'fed' | 'mastery_update' | 'reassess';

export interface ProgressEvent {
  id: string;
  planId: string;
  topicId?: string;
  type: ProgressEventType;
  details?: any;
  ts: string;
}
