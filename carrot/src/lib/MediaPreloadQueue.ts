export enum TaskType {
  POSTER = 'POSTER',
  VIDEO_PREROLL_6S = 'VIDEO_PREROLL_6S', 
  IMAGE = 'IMAGE',
  AUDIO_META = 'AUDIO_META'
}

export enum Priority {
  VISIBLE = 0,    // Highest - anything on screen
  NEXT_10 = 1,    // Next 10 offscreen posts
  PREV_5 = 2      // Just above viewport for backscroll
}

export interface MediaTask {
  id: string;
  postId: string;
  type: TaskType;
  priority: Priority;
  feedIndex: number;
  url: string;
  bucket?: string;
  path?: string;
  abortController: AbortController;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: Error;
}

export interface TaskResult {
  id: string;
  postId: string;
  type: TaskType;
  success: boolean;
  data?: Blob | ArrayBuffer;
  size?: number;
  error?: Error;
  duration: number;
}

interface ConcurrencyLimits {
  [TaskType.POSTER]: number;
  [TaskType.VIDEO_PREROLL_6S]: number;
  [TaskType.IMAGE]: number;
  [TaskType.AUDIO_META]: number;
}

// Singleton MediaPreloadQueue
class MediaPreloadQueue {
  private static _instance: MediaPreloadQueue | null = null;
  
  static get instance(): MediaPreloadQueue {
    if (!this._instance) {
      this._instance = new MediaPreloadQueue();
    }
    return this._instance;
  }

  private tasks = new Map<string, MediaTask>();
  private activeTasks = new Map<TaskType, Set<string>>();
  private completedTasks = new Map<string, TaskResult>();
  private globalBudgetUsed = 0; // bytes
  private isProcessing = false;

  // Configuration
  private readonly GLOBAL_BUDGET_MB = 8; // 8MB total in-flight budget
  private readonly CONCURRENCY_LIMITS: ConcurrencyLimits = {
    [TaskType.POSTER]: 6,
    [TaskType.VIDEO_PREROLL_6S]: 2,
    [TaskType.IMAGE]: 4,
    [TaskType.AUDIO_META]: 3
  };
  
  // Conservative estimates for 6s preload
  private readonly ESTIMATED_SIZES = {
    [TaskType.POSTER]: 0.1, // 100KB
    [TaskType.VIDEO_PREROLL_6S]: 1.5, // 1.5MB for 6s at 2Mbps
    [TaskType.IMAGE]: 0.5, // 500KB
    [TaskType.AUDIO_META]: 0.5 // 500KB
  };

  constructor() {
    // Initialize active task sets
    Object.values(TaskType).forEach(type => {
      this.activeTasks.set(type, new Set());
    });
  }

  // Add task to queue with de-duplication
  enqueue(
    postId: string,
    type: TaskType,
    priority: Priority,
    feedIndex: number,
    url: string,
    bucket?: string,
    path?: string
  ): string {
    const taskId = `${type}:${postId}`;
    
    // De-duplicate: if task exists, update priority if higher
    const existingTask = this.tasks.get(taskId);
    if (existingTask) {
      if (priority < existingTask.priority) {
        existingTask.priority = priority;
        console.log('[MediaPreloadQueue] Updated task priority', { taskId, priority });
      }
      return taskId;
    }

    // Create new task
    const task: MediaTask = {
      id: taskId,
      postId,
      type,
      priority,
      feedIndex,
      url,
      bucket,
      path,
      abortController: new AbortController(),
      createdAt: Date.now()
    };

    this.tasks.set(taskId, task);
    console.log('[MediaPreloadQueue] Enqueued task', { taskId, type, priority, feedIndex });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return taskId;
  }

  // Remove task from queue and abort if running
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Abort if running
    task.abortController.abort();
    
    // Remove from active set
    const activeSet = this.activeTasks.get(task.type);
    activeSet?.delete(taskId);

    // Remove from queue
    this.tasks.delete(taskId);
    
    console.log('[MediaPreloadQueue] Cancelled task', { taskId });
    return true;
  }

  // Cancel all tasks for a post
  cancelPost(postId: string): number {
    let cancelled = 0;
    for (const [taskId, task] of this.tasks) {
      if (task.postId === postId) {
        this.cancel(taskId);
        cancelled++;
      }
    }
    return cancelled;
  }

  // Promote tasks to higher priority (for visible posts)
  promote(postId: string, newPriority: Priority): number {
    let promoted = 0;
    for (const [taskId, task] of this.tasks) {
      if (task.postId === postId && task.priority > newPriority) {
        task.priority = newPriority;
        promoted++;
      }
    }
    if (promoted > 0) {
      console.log('[MediaPreloadQueue] Promoted tasks', { postId, newPriority, count: promoted });
    }
    return promoted;
  }

  // Get task result
  getResult(taskId: string): TaskResult | undefined {
    return this.completedTasks.get(taskId);
  }

  // Check if task is completed
  isCompleted(postId: string, type: TaskType): boolean {
    const taskId = `${type}:${postId}`;
    return this.completedTasks.has(taskId);
  }

  // Get queue stats
  getStats() {
    const byType = new Map<TaskType, { queued: number; active: number; completed: number }>();
    
    Object.values(TaskType).forEach(type => {
      byType.set(type, {
        queued: 0,
        active: this.activeTasks.get(type)?.size || 0,
        completed: 0
      });
    });

    // Count queued tasks
    for (const task of this.tasks.values()) {
      const stats = byType.get(task.type)!;
      stats.queued++;
    }

    // Count completed tasks
    for (const result of this.completedTasks.values()) {
      const stats = byType.get(result.type)!;
      stats.completed++;
    }

    return {
      byType: Object.fromEntries(byType),
      globalBudgetUsed: this.globalBudgetUsed,
      globalBudgetMB: this.GLOBAL_BUDGET_MB,
      isProcessing: this.isProcessing
    };
  }

  // Main processing loop
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.tasks.size > 0) {
        const nextTask = this.selectNextTask();
        if (!nextTask) {
          // No task can run due to concurrency/budget limits
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // Execute task
        await this.executeTask(nextTask);
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Select next task based on priority and constraints
  private selectNextTask(): MediaTask | null {
    // Check global budget
    if (this.globalBudgetUsed >= this.GLOBAL_BUDGET_MB * 1024 * 1024) {
      return null;
    }

    // Sort tasks by priority, then by feed index
    const sortedTasks = Array.from(this.tasks.values()).sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.feedIndex - b.feedIndex;
    });

    // Find first task that can run
    for (const task of sortedTasks) {
      const activeCount = this.activeTasks.get(task.type)?.size || 0;
      const limit = this.CONCURRENCY_LIMITS[task.type];
      
      if (activeCount < limit) {
        // Check if we have budget for this task type
        const estimatedSize = this.ESTIMATED_SIZES[task.type] * 1024 * 1024;
        if (this.globalBudgetUsed + estimatedSize <= this.GLOBAL_BUDGET_MB * 1024 * 1024) {
          return task;
        }
      }
    }

    return null;
  }

  // Execute a single task
  private async executeTask(task: MediaTask): Promise<void> {
    const { id: taskId, type, url, abortController } = task;
    
    // Move to active set
    this.tasks.delete(taskId);
    this.activeTasks.get(type)?.add(taskId);
    
    // Reserve budget
    const estimatedSize = this.ESTIMATED_SIZES[type] * 1024 * 1024;
    this.globalBudgetUsed += estimatedSize;
    
    task.startedAt = Date.now();
    
    console.log('[MediaPreloadQueue] Starting task', { 
      taskId, 
      type, 
      priority: task.priority,
      budgetUsed: Math.round(this.globalBudgetUsed / 1024 / 1024 * 10) / 10 
    });

    try {
      let data: Blob | ArrayBuffer;
      let actualSize = 0;

      switch (type) {
        case TaskType.POSTER:
        case TaskType.IMAGE:
          const imageResponse = await fetch(url, { 
            signal: abortController.signal,
            headers: { 'Accept': 'image/*' }
          });
          if (!imageResponse.ok) throw new Error(`HTTP ${imageResponse.status}`);
          data = await imageResponse.blob();
          actualSize = data.size;
          break;

        case TaskType.VIDEO_PREROLL_6S:
          const videoResponse = await fetch(url, {
            signal: abortController.signal,
            headers: { 
              'Range': 'bytes=0-2097152', // First 2MB for ~6s
              'Accept': 'video/*'
            }
          });
          if (!videoResponse.ok) throw new Error(`HTTP ${videoResponse.status}`);
          data = await videoResponse.arrayBuffer();
          actualSize = data.byteLength;
          break;

        case TaskType.AUDIO_META:
          const audioResponse = await fetch(url, {
            signal: abortController.signal,
            headers: { 
              'Range': 'bytes=0-524288', // First 512KB
              'Accept': 'audio/*'
            }
          });
          if (!audioResponse.ok) throw new Error(`HTTP ${audioResponse.status}`);
          data = await audioResponse.arrayBuffer();
          actualSize = data.byteLength;
          break;

        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      // Task completed successfully
      const result: TaskResult = {
        id: taskId,
        postId: task.postId,
        type,
        success: true,
        data,
        size: actualSize,
        duration: Date.now() - task.startedAt!
      };

      this.completedTasks.set(taskId, result);
      
      console.log('[MediaPreloadQueue] Task completed', { 
        taskId, 
        actualSize: Math.round(actualSize / 1024), 
        duration: result.duration 
      });

    } catch (error) {
      // Task failed
      const result: TaskResult = {
        id: taskId,
        postId: task.postId,
        type,
        success: false,
        error: error as Error,
        duration: Date.now() - task.startedAt!
      };

      this.completedTasks.set(taskId, result);
      
      console.warn('[MediaPreloadQueue] Task failed', { 
        taskId, 
        error: (error as Error).message 
      });

    } finally {
      // Clean up
      this.activeTasks.get(type)?.delete(taskId);
      
      // Adjust budget (use actual size if available, otherwise keep estimate)
      const result = this.completedTasks.get(taskId);
      if (result?.size) {
        this.globalBudgetUsed = this.globalBudgetUsed - estimatedSize + result.size;
      }
    }
  }

  // Clear old completed tasks to prevent memory leaks
  cleanup(maxAge = 5 * 60 * 1000): number { // 5 minutes default
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;
    
    for (const [taskId, result] of this.completedTasks) {
      if (result.duration && (Date.now() - result.duration) > cutoff) {
        this.completedTasks.delete(taskId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log('[MediaPreloadQueue] Cleaned up old results', { count: cleaned });
    }
    
    return cleaned;
  }
}

export default MediaPreloadQueue;
