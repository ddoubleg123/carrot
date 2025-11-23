/**
 * Structured logger for discovery pipeline
 * One-line JSON logs for observability
 */

interface LogContext {
  [key: string]: string | number | boolean | null | undefined
}

export class StructuredLogger {
  private prefix: string

  constructor(prefix = 'DISCOVERY') {
    this.prefix = prefix
  }

  private log(level: string, event: string, context: LogContext = {}) {
    const logLine = JSON.stringify({
      ts: Date.now(),
      level,
      event,
      ...context
    })
    console.log(`[${this.prefix}] ${logLine}`)
  }

  seed(planned: number, uniqueDomains: number, context?: LogContext) {
    this.log('info', 'SEED', { planned, uniqueDomains, ...context })
  }

  fetch(ok: boolean, url: string, bytes?: number, millis?: number, renderer?: string, context?: LogContext) {
    this.log(ok ? 'info' : 'warn', 'FETCH', {
      ok,
      url: url.substring(0, 200),
      bytes,
      millis,
      renderer,
      ...context
    })
  }

  extract(ok: boolean, url: string, chars?: number, paras?: number, context?: LogContext) {
    this.log(ok ? 'info' : 'warn', 'EXTRACT', {
      ok,
      url: url.substring(0, 200),
      chars,
      paras,
      ...context
    })
  }

  save(ok: boolean, id?: string, url?: string, publishDate?: string | null, code?: string, err?: string, context?: LogContext) {
    this.log(ok ? 'info' : 'error', 'SAVE', {
      ok,
      id,
      url: url?.substring(0, 200),
      publishDate,
      code,
      err: err?.substring(0, 200),
      ...context
    })
  }

  hero(action: 'created' | 'updated' | 'skipped' | 'failed', id?: string, url?: string, context?: LogContext) {
    this.log(action === 'failed' ? 'error' : 'info', 'HERO', {
      action,
      id,
      url: url?.substring(0, 200),
      ...context
    })
  }

  seenSkip(url: string, reason?: string, context?: LogContext) {
    this.log('info', 'SEEN-SKIP', {
      url: url.substring(0, 200),
      reason,
      ...context
    })
  }

  paywall(url: string, domain: string, reason?: string, context?: LogContext) {
    this.log('warn', 'PAYWALL', {
      url: url.substring(0, 200),
      domain,
      reason,
      ...context
    })
  }
}

export const discoveryLogger = new StructuredLogger('DISCOVERY')

