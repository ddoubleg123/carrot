// Telemetry utility for Create Group wizard
interface TelemetryEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

class Telemetry {
  private static instance: Telemetry;
  private events: TelemetryEvent[] = [];

  static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  track(event: string, properties?: Record<string, any>) {
    const telemetryEvent: TelemetryEvent = {
      event,
      properties,
      timestamp: Date.now()
    };

    this.events.push(telemetryEvent);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Telemetry]', telemetryEvent);
    }

    // In production, you would send this to your analytics service
    // Example: analytics.track(event, properties);
  }

  // Create Group specific events
  trackGroupCreateOpen() {
    this.track('group_create_open');
  }

  trackStepComplete(step: number, stepName: string, data?: Record<string, any>) {
    this.track(`step_${step}_complete`, {
      step_name: stepName,
      ...data
    });
  }

  trackStepContinue(step: number, stepName: string, latencyMs: number) {
    this.track('step_continue', {
      step,
      step_name: stepName,
      latency_ms: latencyMs,
      slow_continue_flag: latencyMs > 500
    });
  }

  trackGroupCreateSuccess(groupId: string, totalTimeMs: number) {
    this.track('group_create_success', {
      group_id: groupId,
      total_time_ms: totalTimeMs
    });
  }

  trackDiscoveryStarted(patchId: string) {
    this.track('discovery_started', {
      patch_id: patchId
    });
  }

  trackDiscoveryFirstItem(patchId: string, timeMs: number) {
    this.track('discovery_first_item_time_ms', {
      patch_id: patchId,
      time_ms: timeMs
    });
  }

  trackDiscoveryError(patchId: string, error: string) {
    this.track('discovery_error', {
      patch_id: patchId,
      error
    });
  }

  // Performance tracking
  trackPerformance(metric: string, value: number, context?: Record<string, any>) {
    this.track('performance_metric', {
      metric,
      value,
      ...context
    });
  }

  // Get all events (for debugging)
  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  // Clear events (for testing)
  clear() {
    this.events = [];
  }
}

export default Telemetry.getInstance();
