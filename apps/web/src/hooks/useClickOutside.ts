import { useEffect, type RefObject } from "react"
import { useModalPortalRefs } from "./useModalPortalRefs"

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
  extraRefs?: RefObject<HTMLElement | null>[]
) {
  const { getAllRefs } = useModalPortalRefs()

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const path = event.composedPath()

      // Check the main ref
      if (ref.current && path.includes(ref.current as EventTarget)) return

      // Check extra refs (e.g. floating element from useFloating)
      if (extraRefs?.some(r => r.current && path.includes(r.current as EventTarget))) return

      // Check all registered portal refs via useModalPortalRefs
      for (const portalRef of getAllRefs()) {
        if (portalRef.current && path.includes(portalRef.current as EventTarget)) return
      }

      onClose()
    }

    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerDown)
      return () => document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, onClose, ref, extraRefs, getAllRefs])
}
