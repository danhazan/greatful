import { useRef, useCallback, useEffect } from 'react'

export function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollStart = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    if (ref.current) scrollStart.current = ref.current.scrollLeft
    document.body.style.userSelect = 'none'
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !ref.current) return
    e.preventDefault()
    const dx = e.clientX - startX.current
    ref.current.scrollLeft = scrollStart.current - dx
  }, [])

  const onMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.userSelect = ''
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true
    startX.current = e.touches[0].clientX
    if (ref.current) scrollStart.current = ref.current.scrollLeft
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !ref.current) return
    const dx = e.touches[0].clientX - startX.current
    ref.current.scrollLeft = scrollStart.current - dx
  }, [])

  const onTouchEnd = useCallback(() => {
    isDragging.current = false
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const preventClick = (e: MouseEvent) => {
      if (Math.abs(e.clientX - startX.current) > 5) {
        e.stopPropagation()
      }
    }
    el.addEventListener('click', preventClick, true)
    return () => el.removeEventListener('click', preventClick, true)
  }, [])

  return {
    ref,
    dragHandlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  }
}
