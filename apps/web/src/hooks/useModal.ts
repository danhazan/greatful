import { useEffect } from "react"
import { useFocusTrap } from "./useFocusTrap"

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
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollBarWidth}px`

      return () => {
        document.body.style.overflow = ''
        document.body.style.paddingRight = ''
      }
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
