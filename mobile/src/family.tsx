import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type FamilyHome, type FamilyNotice, type NoticeEvent } from './api'
import { useSession } from './session'

type FamilyValue = {
  family: FamilyHome | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
  markNoticesRead: (notificationIds: string[]) => Promise<void>
}

const FamilyContext = createContext<FamilyValue | null>(null)

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const [family, setFamily] = useState<FamilyHome | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      setFamily(await api.family())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your family could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  const applyNotices = useCallback((items: FamilyNotice[]) => {
    setFamily((current) => current ? { ...current, notifications: items } : current)
  }, [])

  const applyEvent = useCallback((event: NoticeEvent) => {
    if (event.type === 'notice') {
      setFamily((current) => {
        if (!current) return current
        const rest = current.notifications.filter((item) => item.notificationId !== event.notice.notificationId)
        const notifications = [event.notice, ...rest].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        return { ...current, notifications }
      })
    }
    if (event.type === 'read') {
      const ids = new Set(event.notificationIds)
      setFamily((current) => current ? {
        ...current,
        notifications: current.notifications.map((item) => ids.has(item.notificationId) ? { ...item, read: true } : item),
      } : current)
    }
  }, [])

  const markNoticesRead = useCallback(async (notificationIds: string[]) => {
    if (notificationIds.length === 0) return
    applyEvent({ type: 'read', notificationIds })
    try {
      const result = await api.parent.markNoticesRead(notificationIds)
      applyNotices(result.items)
    } catch {
      void refresh()
    }
  }, [applyEvent, applyNotices, refresh])

  useEffect(() => {
    if (!user) return
    void refresh()
  }, [user, refresh])

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    let stopped = false
    let delay = 1000

    async function listen() {
      while (!stopped) {
        try {
          await api.parent.watchNotices(applyEvent, controller.signal)
          if (stopped) return
        } catch (err) {
          if (stopped || (err instanceof Error && err.name === 'AbortError')) return
        }
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay = Math.min(delay * 2, 15000)
      }
    }

    void listen()
    const poll = setInterval(() => {
      void api.parent.notices().then((result) => applyNotices(result.items)).catch(() => undefined)
    }, 8000)

    return () => {
      stopped = true
      controller.abort()
      clearInterval(poll)
    }
  }, [user, applyEvent, applyNotices])

  const value = useMemo(
    () => ({ family, loading, error, refresh, markNoticesRead }),
    [family, loading, error, refresh, markNoticesRead],
  )
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
}

export function useFamily() {
  const value = useContext(FamilyContext)
  if (!value) throw new Error('Family is unavailable.')
  return value
}
