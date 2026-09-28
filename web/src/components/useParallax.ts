import { useEffect, useRef } from 'react'

export function useParallax<T extends HTMLElement>(factor = 0.18) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onScroll = () => {
      node.style.transform = `translate3d(0, ${window.scrollY * factor}px, 0) scale(1.08)`
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [factor])

  return ref
}
