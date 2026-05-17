import { useState, useEffect } from "react"

export function useMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleViewportMode = () => setIsMobileViewport(mediaQuery.matches)

    handleViewportMode()
    mediaQuery.addEventListener('change', handleViewportMode)

    return () => mediaQuery.removeEventListener('change', handleViewportMode)
  }, [])

  return isMobileViewport
}
