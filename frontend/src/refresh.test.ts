import { afterEach, describe, expect, it, vi } from 'vitest'
import snapshot from './data/snapshot.json'
import { DASHBOARD_POLL_MS, startDashboardRefresh } from './refresh'
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('automatic dashboard refresh', () => {
  it('publishes new data, keeps the last valid bundle on failure, and recovers without a button', async () => {
    vi.useFakeTimers()
    const updated = {
      ...snapshot,
      source: { ...snapshot.source, fetched_at: '2026-10-22T01:00:00Z' },
    }
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => snapshot })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => updated })
    vi.stubGlobal('fetch', fetch)
    const data = vi.fn(),
      state = vi.fn()
    const refresh = startDashboardRefresh('https://api.example', data, state, () => true)
    await vi.advanceTimersByTimeAsync(0)
    expect(data).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(DASHBOARD_POLL_MS)
    expect(data).toHaveBeenCalledTimes(1)
    expect(state).toHaveBeenLastCalledWith('unavailable')
    await vi.advanceTimersByTimeAsync(DASHBOARD_POLL_MS)
    expect(data).toHaveBeenCalledTimes(2)
    expect(data.mock.calls[1][0].source.fetched_at).toBe(updated.source.fetched_at)
    refresh.stop()
    await vi.advanceTimersByTimeAsync(DASHBOARD_POLL_MS)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('rejects malformed responses and checks on return to a visible tab', async () => {
    vi.useFakeTimers()
    let visible = false
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ schema_version: 999 }) })
    vi.stubGlobal('fetch', fetch)
    const data = vi.fn(),
      state = vi.fn()
    const refresh = startDashboardRefresh('https://api.example', data, state, () => visible)
    await vi.advanceTimersByTimeAsync(DASHBOARD_POLL_MS)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(data).not.toHaveBeenCalled()
    visible = true
    refresh.resume()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(state).toHaveBeenLastCalledWith('unavailable')
    refresh.stop()
  })
})
