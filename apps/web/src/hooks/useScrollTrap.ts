import { useEffect, useRef, type RefObject } from "react"

interface UseScrollTrapOptions {
  disabled?: boolean
}

export function useScrollTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
  options: UseScrollTrapOptions = {}
) {
  const prevOverflow = useRef('')
  const prevPaddingRight = useRef('')

  useEffect(() => {
    const container = containerRef.current
    if (!container || !isActive || options.disabled) return

    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
    prevOverflow.current = document.body.style.overflow
    prevPaddingRight.current = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`
    }

    let touchStartY = 0

    function handleWheel(e: WheelEvent) {
      const el = container!
      const { scrollTop, scrollHeight, clientHeight } = el
      const deltaY = e.deltaY
      const atTop = scrollTop <= 0
      const atBottom = Math.abs(scrollTop + clientHeight - scrollHeight) <= 1

      if ((atTop && deltaY < 0) || (atBottom && deltaY > 0)) {
        e.preventDefault()
      }
    }

    function handleTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0].clientY
    }

    function handleTouchMove(e: TouchEvent) {
      const el = container!
      const { scrollTop, scrollHeight, clientHeight } = el
      const touchY = e.touches[0].clientY
      const deltaY = touchY - touchStartY
      const atTop = scrollTop <= 0
      const atBottom = Math.abs(scrollTop + clientHeight - scrollHeight) <= 1

      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        e.preventDefault()
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      document.body.style.overflow = prevOverflow.current
      document.body.style.paddingRight = prevPaddingRight.current
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
    }
  }, [containerRef, isActive, options.disabled])
}
