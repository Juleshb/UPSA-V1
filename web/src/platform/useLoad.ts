import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api'

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    let active = true
    setLoading(true)
    setError('')
    loader()
      .then((value) => {
        if (active) setData(value)
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Unable to load this view.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, deps)

  useEffect(() => reload(), [reload])

  return { data, error, loading, reload, setData }
}
