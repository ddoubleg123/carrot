export enum TaskType {
  POSTER = 'POSTER',
  VIDEO_PREROLL_6S = 'VIDEO_PREROLL_6S', 
  IMAGE = 'IMAGE',
  AUDIO_META = 'AUDIO_META',
  TEXT_FULL = 'TEXT_FULL',
  AUDIO_FULL = 'AUDIO_FULL',
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
  isBlocking?: boolean; 
  dependsOn?: string; 
}

export interface TaskResult {
  id: string;
  postId: string;
  type: TaskType;
  success: boolean;
  data?: Blob | ArrayBuffer | string;
  size?: number;
  error?: Error;
  duration: number;
  completedAt: number;
}

interface ConcurrencyLimits {
  [TaskType.POSTER]: number;
  [TaskType.VIDEO_PREROLL_6S]: number;
  [TaskType.IMAGE]: number;
  [TaskType.AUDIO_META]: number;
  [TaskType.TEXT_FULL]: number;
  [TaskType.AUDIO_FULL]: number;
}

interface SequentialConfig {
  maxConcurrentPosters: number;
  maxConcurrentVideos: number;
  maxSequentialGap: number; 
  posterBlocksProgression: boolean;
  videoBlocksProgression: boolean;
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
  private globalBudgetUsed = 0; 
  private isProcessing = false;
  
  private lastCompletedPosterIndex = -1; 
  private lastCompletedVideoIndex = -1;  
  private blockedTasks = new Set<string>(); 

  private readonly GLOBAL_BUDGET_MB = 8; 
  
  private readonly CONCURRENCY_LIMITS: ConcurrencyLimits = {
    [TaskType.POSTER]: 6,       
    [TaskType.VIDEO_PREROLL_6S]: 2, 
    [TaskType.IMAGE]: 4,
    [TaskType.AUDIO_META]: 3,
    [TaskType.TEXT_FULL]: 4,
    [TaskType.AUDIO_FULL]: 2,
  };
  
  private readonly SEQUENTIAL_CONFIG: SequentialConfig = {
    maxConcurrentPosters: 6,
    maxConcurrentVideos: 2,
    maxSequentialGap: 10,       
    posterBlocksProgression: true, 
    videoBlocksProgression: false  
  };
  
  private readonly ESTIMATED_SIZES = {
    [TaskType.POSTER]: 0.1, 
    [TaskType.VIDEO_PREROLL_6S]: 1.5, 
    [TaskType.IMAGE]: 0.5, 
    [TaskType.AUDIO_META]: 0.5, 
    [TaskType.TEXT_FULL]: 0.2,
    [TaskType.AUDIO_FULL]: 2.0,
  } as Record<TaskType, number>;

  constructor() {
    Object.values(TaskType).forEach(type => {
      this.activeTasks.set(type, new Set());
    });
  }

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
    
    const existingTask = this.tasks.get(taskId);
    if (existingTask) {
      if (priority < existingTask.priority) {
        existingTask.priority = priority;
        console.log('[MediaPreloadQueue] Updated task priority', { taskId, priority });
      }
      return taskId;
    }

    const isBlocking = this.isTaskBlocking(type, feedIndex);
    const dependsOn = this.getDependency(type, feedIndex);

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
      createdAt: Date.now(),
      isBlocking,
      dependsOn
    };

    this.tasks.set(taskId, task);
    
    if (dependsOn && !this.completedTasks.has(dependsOn)) {
      this.blockedTasks.add(taskId);
      console.log('[MediaPreloadQueue] Task blocked by dependency', { 
        taskId, 
        dependsOn, 
        feedIndex,
        isBlocking 
      });
    }

    console.log('[MediaPreloadQueue] Enqueued task', { 
      taskId, 
      type, 
      priority, 
      feedIndex,
      isBlocking,
      dependsOn: dependsOn || 'none'
    });

    if (!this.isProcessing) {
      this.processQueue();
    }

    return taskId;
  }

  private isTaskBlocking(type: TaskType, feedIndex: number): boolean {
    switch (type) {
      case TaskType.POSTER:
        return this.SEQUENTIAL_CONFIG.posterBlocksProgression;
      case TaskType.VIDEO_PREROLL_6S:
        return this.SEQUENTIAL_CONFIG.videoBlocksProgression;
      default:
        return false;
    }
  }

  private getDependency(type: TaskType, feedIndex: number): string | undefined {
    if (feedIndex === 0) return undefined; 

    switch (type) {
      case TaskType.POSTER:
        return `${TaskType.POSTER}:post-${feedIndex - 1}`;
      
      case TaskType.VIDEO_PREROLL_6S:
        return `${TaskType.POSTER}:post-${feedIndex}`;
      
      default:
        return undefined;
    }
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
    
    // Remove from blocked set if present
    this.blockedTasks.delete(taskId);
    
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

  // Get queue statistics
  getStats() {
    const activeCounts = new Map<TaskType, number>();
    for (const [type, tasks] of this.activeTasks) {
      activeCounts.set(type, tasks.size);
    }

    // Create byType structure that dashboard expects
    const byType = new Map<TaskType, { queued: number; active: number; completed: number; blocked: number }>();
    
    Object.values(TaskType).forEach(type => {
      byType.set(type, {
        queued: 0,
        active: this.activeTasks.get(type)?.size || 0,
        completed: 0,
        blocked: 0
      });
    });

    // Count queued tasks
    for (const task of this.tasks.values()) {
      const stats = byType.get(task.type)!;
      const isActive = this.activeTasks.get(task.type)?.has(task.id);
      if (!isActive) {
        stats.queued++;
      }
      if (this.blockedTasks.has(task.id)) {
        stats.blocked++;
      }
    }

    // Count completed tasks
    for (const result of this.completedTasks.values()) {
      const stats = byType.get(result.type)!;
      stats.completed++;
    }

    const queuedByPriority = new Map<Priority, number>();
    for (const task of this.tasks.values()) {
      const isActive = this.activeTasks.get(task.type)?.has(task.id);
      if (!isActive) {
        queuedByPriority.set(task.priority, (queuedByPriority.get(task.priority) || 0) + 1);
      }
    }

    return {
      queued: this.tasks.size - Array.from(activeCounts.values()).reduce((sum, count) => sum + count, 0),
      active: Array.from(activeCounts.values()).reduce((sum, count) => sum + count, 0),
      completed: this.completedTasks.size,
      blocked: this.blockedTasks.size,
      isProcessing: this.isProcessing,
      activeCounts: Object.fromEntries(activeCounts),
      queuedByPriority: Object.fromEntries(queuedByPriority),
      byType: Object.fromEntries(byType),
      globalBudgetUsed: this.globalBudgetUsed,
      globalBudgetMB: this.GLOBAL_BUDGET_MB,
      sequentialStats: {
        lastCompletedPosterIndex: this.lastCompletedPosterIndex,
        lastCompletedVideoIndex: this.lastCompletedVideoIndex,
        maxSequentialGap: this.SEQUENTIAL_CONFIG.maxSequentialGap
      },
      memoryUsage: {
        estimatedMB: this.globalBudgetUsed / (1024 * 1024),
        budgetMB: this.GLOBAL_BUDGET_MB
      }
    };
  }

  private processQueue(): void {
    // Start tasks that can be started
    for (const task of this.tasks.values()) {
      const activeSet = this.activeTasks.get(task.type);
      if (!activeSet || activeSet.has(task.id)) continue; // Skip if already active

      // Check if we can start this task
      if (!this.canStartTask(task)) {
        this.blockedTasks.add(task.id);
        continue;
      }

      // Check concurrency limits
      if (activeSet.size >= this.CONCURRENCY_LIMITS[task.type]) {
        continue;
      }

      // Check memory budget
      const estimatedTaskSize = this.ESTIMATED_SIZES[task.type] * 1024 * 1024;
      if (this.globalBudgetUsed + estimatedTaskSize > this.GLOBAL_BUDGET_MB * 1024 * 1024) {
        continue;
      }

      // Start the task
      this.executeTask(task);
    }
  }

  private canStartTask(task: MediaTask): boolean {
    if (task.dependsOn && !this.completedTasks.has(task.dependsOn)) {
      return false;
    }

    const currentIndex = Math.max(this.lastCompletedPosterIndex, this.lastCompletedVideoIndex);
    if (task.feedIndex > currentIndex + this.SEQUENTIAL_CONFIG.maxSequentialGap) {
      return false;
    }

    const activeCount = this.activeTasks.get(task.type)?.size || 0;
    const limit = this.CONCURRENCY_LIMITS[task.type];
    if (activeCount >= limit) {
      return false;
    }

    const estimatedSize = this.ESTIMATED_SIZES[task.type] * 1024 * 1024;
    if (this.globalBudgetUsed + estimatedSize > this.GLOBAL_BUDGET_MB * 1024 * 1024) {
      return false;
    }

    return true;
  }

  private async executeTask(task: MediaTask): Promise<void> {
    const { id: taskId, type, url, abortController } = task;
    
    this.tasks.delete(taskId);
    this.activeTasks.get(type)?.add(taskId);
    
    const estimatedSize = this.ESTIMATED_SIZES[type] * 1024 * 1024;
    this.globalBudgetUsed += estimatedSize;
    
    task.startedAt = Date.now();
    
    console.log('[MediaPreloadQueue] Starting task', { 
      taskId, 
      type, 
      priority: task.priority,
      feedIndex: task.feedIndex,
      isBlocking: task.isBlocking,
      budgetUsed: Math.round(this.globalBudgetUsed / 1024 / 1024 * 10) / 10 
    });

    try {
      let data: Blob | ArrayBuffer | string;
      let actualSize = 0;

      switch (type) {
        case TaskType.POSTER:
        case TaskType.IMAGE: {
          const imageResponse = await fetch(url, { 
            signal: abortController.signal,
            headers: { 'Accept': 'image/*' }
          });
          if (!imageResponse.ok) throw new Error(`HTTP ${imageResponse.status}`);
          const blob = await imageResponse.blob();
          data = blob;
          actualSize = blob.size;
          break;
        }

        case TaskType.VIDEO_PREROLL_6S: {
          const videoResponse = await fetch(url, {
            signal: abortController.signal,
            headers: { 
              'Range': 'bytes=0-2097152', 
              'Accept': 'video/*'
            }
          });
          if (!videoResponse.ok) throw new Error(`HTTP ${videoResponse.status}`);
          const buf = await videoResponse.arrayBuffer();
          data = buf;
          actualSize = buf.byteLength;
          break;
        }

        case TaskType.AUDIO_META: {
          const audioResponse = await fetch(url, {
            signal: abortController.signal,
            headers: { 
              'Range': 'bytes=0-524288', 
              'Accept': 'audio/*'
            }
          });
          if (!audioResponse.ok) throw new Error(`HTTP ${audioResponse.status}`);
          const buf = await audioResponse.arrayBuffer();
          data = buf;
          actualSize = buf.byteLength;
          break;
        }

        case TaskType.AUDIO_FULL: {
          const audioResponse = await fetch(url, {
            signal: abortController.signal,
            headers: { 'Accept': 'audio/*' }
          });
          if (!audioResponse.ok) throw new Error(`HTTP ${audioResponse.status}`);
          const buf = await audioResponse.arrayBuffer();
          data = buf;
          actualSize = buf.byteLength;
          break;
        }

        case TaskType.TEXT_FULL: {
          const textResponse = await fetch(url, { signal: abortController.signal, headers: { 'Accept': 'application/json, text/*;q=0.9,*/*;q=0.8' } });
          if (!textResponse.ok) throw new Error(`HTTP ${textResponse.status}`);
          const text = await textResponse.text();
          data = text;
          actualSize = new Blob([text]).size;
          break;
        }

        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      const result: TaskResult = {
        id: taskId,
        postId: task.postId,
        type,
        success: true,
        data,
        size: actualSize,
        duration: Date.now() - task.startedAt!,
        completedAt: Date.now()
      };

      this.completedTasks.set(taskId, result);
      
      this.handleTaskCompletion(taskId, result);
      
      console.log('[MediaPreloadQueue] Task completed', { 
        taskId, 
        feedIndex: task.feedIndex,
        actualSize: Math.round(actualSize / 1024), 
        duration: result.duration,
        isBlocking: task.isBlocking
      });

    } catch (error) {
      const result: TaskResult = {
        id: taskId,
        postId: task.postId,
        type,
        success: false,
        error: error as Error,
        duration: Date.now() - task.startedAt!,
        completedAt: Date.now()
      };

      this.completedTasks.set(taskId, result);
      
      this.handleTaskCompletion(taskId, result);
      
      console.warn('[MediaPreloadQueue] Task failed', { 
        taskId, 
        feedIndex: task.feedIndex,
        error: (error as Error).message,
        isBlocking: task.isBlocking
      });

    } finally {
      this.activeTasks.get(type)?.delete(taskId);
      
      const result = this.completedTasks.get(taskId);
      if (result?.size) {
        this.globalBudgetUsed = this.globalBudgetUsed - estimatedSize + result.size;
      }
    }
  }

  private handleTaskCompletion(taskId: string, result: TaskResult): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (result.success) {
      if (task.type === TaskType.POSTER) {
        this.lastCompletedPosterIndex = Math.max(this.lastCompletedPosterIndex, task.feedIndex);
        console.log('[MediaPreloadQueue] Poster sequence advanced', { 
          feedIndex: task.feedIndex,
          lastCompleted: this.lastCompletedPosterIndex
        });
      } else if (task.type === TaskType.VIDEO_PREROLL_6S) {
        this.lastCompletedVideoIndex = Math.max(this.lastCompletedVideoIndex, task.feedIndex);
        console.log('[MediaPreloadQueue] Video sequence advanced', { 
          feedIndex: task.feedIndex,
          lastCompleted: this.lastCompletedVideoIndex
        });
      }
    }

    this.unblockDependentTasks(taskId);
  }

  private unblockDependentTasks(completedTaskId: string): void {
    const unblocked: string[] = [];
    
    for (const blockedTaskId of this.blockedTasks) {
      const task = this.tasks.get(blockedTaskId);
      if (task?.dependsOn === completedTaskId) {
        this.blockedTasks.delete(blockedTaskId);
        unblocked.push(blockedTaskId);
      }
    }

    if (unblocked.length > 0) {
      console.log('[MediaPreloadQueue] Unblocked dependent tasks', { 
        completedTaskId, 
        unblocked: unblocked.length 
      });
    }
  }

  private selectNextTask(): MediaTask | null {
    if (this.globalBudgetUsed >= this.GLOBAL_BUDGET_MB * 1024 * 1024) {
      return null;
    }

    const availableTasks = Array.from(this.tasks.values())
      .filter(task => !this.blockedTasks.has(task.id)) 
      .filter(task => this.canStartTask(task)) 
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        
        const aAdvancesSequence = this.doesTaskAdvanceSequence(a);
        const bAdvancesSequence = this.doesTaskAdvanceSequence(b);
        if (aAdvancesSequence !== bAdvancesSequence) {
          return bAdvancesSequence ? 1 : -1; 
        }
        
        return a.feedIndex - b.feedIndex;
      });

    return availableTasks[0] || null;
  }

  private doesTaskAdvanceSequence(task: MediaTask): boolean {
    switch (task.type) {
      case TaskType.POSTER:
        return task.feedIndex === this.lastCompletedPosterIndex + 1;
      case TaskType.VIDEO_PREROLL_6S:
        return task.feedIndex === this.lastCompletedVideoIndex + 1;
      default:
        return false;
    }
  }

  getSequentialStats() {
    return {
      lastCompletedPosterIndex: this.lastCompletedPosterIndex,
      lastCompletedVideoIndex: this.lastCompletedVideoIndex,
      blockedTasksCount: this.blockedTasks.size,
      maxSequentialGap: this.SEQUENTIAL_CONFIG.maxSequentialGap,
      posterBlocksProgression: this.SEQUENTIAL_CONFIG.posterBlocksProgression,
      videoBlocksProgression: this.SEQUENTIAL_CONFIG.videoBlocksProgression
    };
  }

  // Clean up old completed tasks
  cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [taskId, result] of this.completedTasks) {
      if (now - result.completedAt > maxAge) {
        this.completedTasks.delete(taskId);
      }
    }
  }

}

export default MediaPreloadQueue.instance;
