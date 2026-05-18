import { useEffect } from "react"
import { useFocusTrap } from "./useFocusTrap"
import { lockScroll, unlockScroll } from "@/utils/scrollLock"

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

  useFocusTrap(modalRef, isOpen && enableTabTrap)

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen && shouldLockScroll) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [isOpen, shouldLockScroll])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, modalRef])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])
}
