import { useEffect, useRef } from "react"
import { useFocusTrap } from "./useFocusTrap"
import { lockScroll, unlockScroll } from "@/utils/scrollLock"
import { useModalPortalRefs } from "./useModalPortalRefs"

interface UseModalOptions {
  enableTabTrap?: boolean
  scrollLock?: boolean
}

export function useModal(
  modalRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
  options: UseModalOptions = {}
) {
  const { enableTabTrap = false, scrollLock: shouldLockScroll = true } = options
  const { getAllRefs } = useModalPortalRefs()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useFocusTrap(modalRef, isOpen && enableTabTrap)

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen && shouldLockScroll) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [isOpen, shouldLockScroll])

  // Handle click outside to close — portal-aware via composedPath()
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const path = event.composedPath()

      // Click inside the modal itself — do nothing
      if (modalRef.current && path.includes(modalRef.current as EventTarget)) return

      // Click inside any registered portal (e.g. FloatingPortal dropdown) — do nothing
      for (const portalRef of getAllRefs()) {
        if (portalRef.current && path.includes(portalRef.current as EventTarget)) return
      }

      onCloseRef.current()
    }

    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerDown)
      return () => document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, modalRef, getAllRefs])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])
}
