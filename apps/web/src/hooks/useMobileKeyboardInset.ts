import { useState, useEffect } from "react"

export function useMobileKeyboardInset(isMobileViewport: boolean) {
  const [mobileKeyboardInset, setMobileKeyboardInset] = useState(0)

  useEffect(() => {
    if (!isMobileViewport || typeof window === 'undefined') return

    if (!window.visualViewport) {
      setMobileKeyboardInset(0)
      return
    }

    const viewport = window.visualViewport
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop))
      setMobileKeyboardInset(inset)
    }

    updateInset()
    viewport.addEventListener('resize', updateInset)
    viewport.addEventListener('scroll', updateInset)

    return () => {
      viewport.removeEventListener('resize', updateInset)
      viewport.removeEventListener('scroll', updateInset)
      setMobileKeyboardInset(0)
    }
  }, [isMobileViewport])

  return mobileKeyboardInset
}
