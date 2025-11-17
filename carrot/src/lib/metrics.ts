/**
 * Minimal metrics helper (counter-style in logs)
 */

import { slog } from './log'

export function inc(name: string, value = 1, dims?: Record<string, unknown>): void {
  slog('info', { step: 'metric', metric: name, value, ...dims })
}

