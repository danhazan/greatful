/**
 * Development-only performance instrumentation.
 *
 * All calls are no-ops in production.
 */

const PERF_PREFIX = '[perf]'

function isDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

export function perfStart(label: string): number | null {
  if (!isDev()) return null
  if (typeof performance === 'undefined') return null
  const t = performance.now()
  console.log(`${PERF_PREFIX} ${label} start`, t.toFixed(1))
  return t
}

export function perfEnd(label: string, start: number | null): void {
  if (start === null) return
  const elapsed = (performance.now() - start).toFixed(1)
  console.log(`${PERF_PREFIX} ${label} end`, `${elapsed}ms`)
}

export function perfLog(label: string, ...args: unknown[]): void {
  if (!isDev()) return
  console.log(`${PERF_PREFIX} ${label}`, ...args)
}
