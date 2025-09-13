import { useEffect, useRef, useCallback } from 'react'

interface UseKeyboardNavigationOptions {
  isOpen: boolean
  itemCount: number
  selectedIndex: number
  onIndexChange: (index: number) => void
  onSelect: () => void
  onClose: () => void
  scrollBehavior?: ScrollBehavior
}

/**
 * Custom hook for managing keyboard navigation in dropdown menus with automatic scrolling
 * Returns refs that should be used directly on the dropdown items for reliable scrolling
 */
export function useKeyboardNavigation({
  isOpen,
  itemCount,
  selectedIndex,
  onIndexChange,
  onSelect,
  onClose,
  scrollBehavior = 'smooth'
}: UseKeyboardNavigationOptions) {
  const itemRefs = useRef<(HTMLElement | null)[]>([])

  // Initialize refs array when item count changes
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, itemCount)
  }, [itemCount])

  // Scroll selected item into view when selectedIndex changes
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      const selectedItem = itemRefs.current[selectedIndex]
      if (!selectedItem) return

      // Find the scrollable container by looking for overflow-y-auto or max-h classes
      let scrollContainer = selectedItem.parentElement
      while (scrollContainer) {
        const style = window.getComputedStyle(scrollContainer)
        const classList = scrollContainer.classList
        
        if (
          style.overflowY === 'auto' || 
          style.overflowY === 'scroll' || 
          classList.contains('overflow-y-auto') ||
          classList.contains('max-h-60') ||
          classList.contains('max-h-72') ||
          classList.contains('max-h-80')
        ) {
          break
        }
        scrollContainer = scrollContainer.parentElement
      }

      if (scrollContainer) {
        // Check if item is visible in container
        const containerRect = scrollContainer.getBoundingClientRect()
        const itemRect = selectedItem.getBoundingClientRect()
        
        const isVisible = (
          itemRect.top >= containerRect.top &&
          itemRect.bottom <= containerRect.bottom
        )

        if (!isVisible) {
          // Check if scrollIntoView is available (not in test environment)
          if (typeof selectedItem.scrollIntoView === 'function') {
            selectedItem.scrollIntoView({
              behavior: scrollBehavior,
              block: 'nearest',
              inline: 'nearest'
            })
          }
        }
      } else {
        // Fallback to default scrollIntoView
        if (typeof selectedItem.scrollIntoView === 'function') {
          selectedItem.scrollIntoView({
            behavior: scrollBehavior,
            block: 'nearest',
          })
        }
      }
    }
  }, [selectedIndex, scrollBehavior])

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || itemCount === 0) {
        if (event.key === 'Escape') {
          onClose()
        }
        return
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          onIndexChange((selectedIndex + 1) % itemCount)
          break
        case 'ArrowUp':
          event.preventDefault()
          onIndexChange((selectedIndex - 1 + itemCount) % itemCount)
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          onSelect()
          break
        case 'Escape':
          event.preventDefault()
          onClose()
          break
        case 'Home':
          event.preventDefault()
          onIndexChange(0)
          break
        case 'End':
          event.preventDefault()
          onIndexChange(itemCount - 1)
          break
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, itemCount, selectedIndex, onIndexChange, onSelect, onClose])

  // Function to set ref for a specific item
  const setItemRef = useCallback((index: number) => (el: HTMLElement | null) => {
    itemRefs.current[index] = el
  }, [])

  return {
    setItemRef,
    itemRefs: itemRefs.current
  }
}