import { useRef, useCallback, useEffect } from "react"

interface UseLongPressOptions {
  threshold?: number
  onLongPress: (target: HTMLElement) => void
}

export function useLongPress({ onLongPress, threshold = 500 }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const longPressOccurredRef = useRef(false)
  const onLongPressRef = useRef(onLongPress)
  const targetRef = useRef<HTMLElement | null>(null)
  onLongPressRef.current = onLongPress

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = undefined
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    longPressOccurredRef.current = false
    if (e.button !== 0) return
    targetRef.current = e.currentTarget as HTMLElement
    clear()
    timerRef.current = setTimeout(() => {
      longPressOccurredRef.current = true
      timerRef.current = undefined
      if (targetRef.current) {
        onLongPressRef.current(targetRef.current)
      }
    }, threshold)
  }, [threshold, clear])

  const onPointerUp = useCallback(() => {
    clear()
  }, [clear])

  const onPointerCancel = useCallback(() => {
    clear()
  }, [clear])

  const onPointerLeave = useCallback(() => {
    clear()
  }, [clear])

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (longPressOccurredRef.current || timerRef.current !== undefined) {
      e.preventDefault()
    }
  }, [])

  const consumeLongPress = useCallback(() => {
    const value = longPressOccurredRef.current
    longPressOccurredRef.current = false
    return value
  }, [])

  useEffect(() => {
    return () => clear()
  }, [clear])

  return {
    handlers: {
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onContextMenu,
      style: {
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as React.CSSProperties,
    },
    consumeLongPress,
  }
}
