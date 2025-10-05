export const ROUTING_THRESHOLDS = {
  HIGH: 0.7,
  LOW: 0.45,
};

export type RoutingDecision = 'approved' | 'queued' | 'rejected';

export function decideByScore(score: number): RoutingDecision {
  if (score >= ROUTING_THRESHOLDS.HIGH) return 'approved';
  if (score >= ROUTING_THRESHOLDS.LOW) return 'queued';
  return 'rejected';
}
