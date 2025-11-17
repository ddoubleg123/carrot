/**
 * Structured logger for production observability
 * Emits one-line JSON logs with consistent fields
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export function slog(level: LogLevel, obj: Record<string, unknown>): void {
  const base = { ts: new Date().toISOString(), level }

  try {
    // Avoid newlines; limit big fields
    const scrubbed = Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        if (typeof v === 'string' && v.length > 256) {
          return [k, v.slice(0, 256) + '…']
        }
        // Convert undefined to null for JSON serialization
        if (v === undefined) {
          return [k, null]
        }
        return [k, v]
      })
    )

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ...base, ...scrubbed }))
  } catch {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ...base, msg: 'log_serialize_fail' }))
  }
}

