/**
 * Minimal metrics helper (counter-style in logs)
 */

import { slog } from './log'

export function inc(name: string, value = 1, dims?: Record<string, unknown>): void {
  slog('info', { step: 'metric', metric: name, value, ...dims })
}

/**
 * Record histogram (distribution) metric
 */
export function histogram(name: string, value: number, dims?: Record<string, unknown>): void {
  slog('info', { step: 'metric', metric: name, type: 'histogram', value, ...dims })
}

/**
 * Record gauge (current value) metric
 */
export function gauge(name: string, value: number, dims?: Record<string, unknown>): void {
  slog('info', { step: 'metric', metric: name, type: 'gauge', value, ...dims })
}

