import { bundleSchema } from './schema'
import type { Bundle } from './schema'
export const DASHBOARD_POLL_MS = 5 * 60 * 1000
export type Connection = 'bundled' | 'connecting' | 'connected' | 'unavailable'
export function startDashboardRefresh(
  api: string,
  onData: (bundle: Bundle) => void,
  onState: (state: Connection) => void,
  visible: () => boolean,
) {
  let stopped = false,
    busy = false,
    lastAttempt = 0
  let controller: AbortController | undefined
  const update = async () => {
    if (busy || stopped) return
    busy = true
    lastAttempt = Date.now()
    controller = new AbortController()
    const timeout = setTimeout(() => controller?.abort(), 8000)
    try {
      const response = await fetch(`${api}/api/dashboard`, {
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Data unavailable')
      const next = bundleSchema.parse(await response.json())
      if (!stopped) {
        onData(next)
        onState('connected')
      }
    } catch {
      if (!stopped) onState('unavailable')
    } finally {
      clearTimeout(timeout)
      busy = false
    }
  }
  onState('connecting')
  void update()
  const timer = setInterval(() => {
    if (visible()) void update()
  }, DASHBOARD_POLL_MS)
  return {
    resume: () => {
      if (visible() && Date.now() - lastAttempt >= DASHBOARD_POLL_MS) void update()
    },
    stop: () => {
      stopped = true
      controller?.abort()
      clearInterval(timer)
    },
  }
}
