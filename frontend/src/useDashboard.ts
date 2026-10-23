import { useEffect, useState } from 'react'
import type { Bundle } from './schema'
import { startDashboardRefresh } from './refresh'
import type { Connection } from './refresh'
export function useDashboard(initial: Bundle, api?: string) {
  const [bundle, setBundle] = useState(initial)
  const [connection, setConnection] = useState<Connection>('bundled')
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(clock)
  }, [])
  useEffect(() => {
    if (!api) return
    const refresh = startDashboardRefresh(
      api,
      (next) => {
        setBundle(next)
        setNow(Date.now())
      },
      setConnection,
      () => document.visibilityState === 'visible',
    )
    const resume = () => {
      setNow(Date.now())
      refresh.resume()
    }
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    return () => {
      refresh.stop()
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('online', resume)
    }
  }, [api])
  return { bundle, connection, now }
}
