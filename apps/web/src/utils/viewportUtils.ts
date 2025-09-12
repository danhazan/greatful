import React from 'react'

/**
 * Viewport utilities for responsive design and mobile optimization
 */

/**
 * Check if the current viewport is mobile-sized
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 640 // sm breakpoint
}

/**
 * Check if the current viewport is tablet-sized
 */
export function isTabletViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= 640 && window.innerWidth < 1024 // sm to lg breakpoint
}

/**
 * Check if the current viewport is desktop-sized
 */
export function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= 1024 // lg breakpoint and above
}

/**
 * Get viewport dimensions
 */
export function getViewportDimensions() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 }
  }
  
  return {
    width: window.innerWidth,
    height: window.innerHeight
  }
}

/**
 * Calculate optimal dropdown position to avoid viewport overflow
 */
export function calculateDropdownPosition(
  triggerElement: HTMLElement,
  dropdownWidth: number,
  dropdownHeight: number,
  options: {
    preferredPosition?: 'left' | 'right' | 'center'
    offset?: number
    viewportPadding?: number
  } = {}
) {
  const {
    preferredPosition = 'left',
    offset = 8,
    viewportPadding = 16
  } = options

  const triggerRect = triggerElement.getBoundingClientRect()
  const viewport = getViewportDimensions()
  
  // Calculate available space
  const spaceLeft = triggerRect.left - viewportPadding
  const spaceRight = viewport.width - triggerRect.right - viewportPadding
  const spaceBelow = viewport.height - triggerRect.bottom - viewportPadding
  const spaceAbove = triggerRect.top - viewportPadding

  // Determine horizontal position
  let left = triggerRect.left
  let right = 'auto'
  
  if (preferredPosition === 'right') {
    // Try to align to the right edge of trigger
    const rightAlignedLeft = triggerRect.right - dropdownWidth
    if (rightAlignedLeft >= viewportPadding) {
      left = rightAlignedLeft
    } else if (spaceRight >= dropdownWidth) {
      left = triggerRect.left
    } else {
      // Not enough space, align to viewport edge
      left = viewportPadding
    }
  } else if (preferredPosition === 'center') {
    // Try to center on trigger
    const centeredLeft = triggerRect.left + (triggerRect.width - dropdownWidth) / 2
    if (centeredLeft >= viewportPadding && centeredLeft + dropdownWidth <= viewport.width - viewportPadding) {
      left = centeredLeft
    } else if (spaceRight >= dropdownWidth) {
      left = triggerRect.left
    } else {
      left = Math.max(viewportPadding, viewport.width - dropdownWidth - viewportPadding)
    }
  } else {
    // Default: left align
    if (spaceRight >= dropdownWidth) {
      left = triggerRect.left
    } else if (spaceLeft >= dropdownWidth) {
      left = triggerRect.right - dropdownWidth
    } else {
      // Not enough space on either side, use available space
      left = viewportPadding
      dropdownWidth = Math.min(dropdownWidth, viewport.width - 2 * viewportPadding)
    }
  }

  // Determine vertical position
  let top = triggerRect.bottom + offset
  let maxHeight = spaceBelow

  if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
    // Show above if there's more space
    top = triggerRect.top - dropdownHeight - offset
    maxHeight = spaceAbove
  }

  return {
    position: {
      left: Math.max(viewportPadding, left),
      top: Math.max(viewportPadding, top),
      maxWidth: Math.min(dropdownWidth, viewport.width - 2 * viewportPadding),
      maxHeight: Math.min(dropdownHeight, maxHeight)
    },
    fitsInViewport: {
      horizontal: left >= viewportPadding && left + dropdownWidth <= viewport.width - viewportPadding,
      vertical: spaceBelow >= dropdownHeight || spaceAbove >= dropdownHeight
    }
  }
}

/**
 * Debounced viewport resize handler
 */
export function createViewportResizeHandler(
  callback: () => void,
  delay: number = 150
) {
  let timeoutId: NodeJS.Timeout | null = null
  
  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(callback, delay)
  }
}

/**
 * Hook to detect viewport size changes
 */
export function useViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, isMobile: false, isTablet: false, isDesktop: false }
  }

  const [dimensions, setDimensions] = React.useState(() => getViewportDimensions())

  React.useEffect(() => {
    const handleResize = createViewportResizeHandler(() => {
      setDimensions(getViewportDimensions())
    })

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    width: dimensions.width,
    height: dimensions.height,
    isMobile: dimensions.width < 640,
    isTablet: dimensions.width >= 640 && dimensions.width < 1024,
    isDesktop: dimensions.width >= 1024
  }
}

