export type TrainingPlanStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled';
export type TrainingTaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'skipped';

export interface TrainingPlanOptions {
  perTopicMax: number; // default 200
  sourceTypes: string[];
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
  topics: string[];
  options: TrainingPlanOptions;
  status: TrainingPlanStatus;
  createdAt: string;
  updatedAt: string;
  totals: TrainingPlanTotals;
  // internal cursor per topic (next page)
  topicPages: Record<string, number>;
}
