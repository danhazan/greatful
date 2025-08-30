/**
 * Haptic feedback utilities for touch interactions
 */

export type HapticIntensity = 'light' | 'medium' | 'heavy'

/**
 * Provides haptic feedback on supported devices
 * @param intensity - The intensity of the haptic feedback
 */
export const triggerHapticFeedback = (intensity: HapticIntensity = 'light'): void => {
  // Check if the device supports vibration
  if (!('vibrate' in navigator)) {
    return
  }

  // Map intensity to vibration duration
  const vibrationMap: Record<HapticIntensity, number> = {
    light: 10,
    medium: 20,
    heavy: 30
  }

  try {
    navigator.vibrate(vibrationMap[intensity])
  } catch (error) {
    // Silently fail if vibration is not supported or blocked
    console.debug('Haptic feedback not available:', error)
  }
}

/**
 * Provides haptic feedback for button interactions
 */
export const buttonHaptic = (): void => {
  triggerHapticFeedback('light')
}

/**
 * Provides haptic feedback for selection interactions
 */
export const selectionHaptic = (): void => {
  triggerHapticFeedback('medium')
}

/**
 * Provides haptic feedback for success interactions
 */
export const successHaptic = (): void => {
  triggerHapticFeedback('heavy')
}

/**
 * Custom hook for haptic feedback
 */
export const useHapticFeedback = () => {
  return {
    triggerHaptic: triggerHapticFeedback,
    buttonHaptic,
    selectionHaptic,
    successHaptic
  }
}

/**
 * Touch event handlers with haptic feedback
 * Note: We don't call preventDefault() to avoid passive event listener issues
 */
export const createTouchHandlers = (
  onTouch?: () => void,
  intensity: HapticIntensity = 'light'
) => {
  return {
    onTouchStart: (e: React.TouchEvent) => {
      // Trigger haptic feedback
      triggerHapticFeedback(intensity)
      
      // Visual feedback with safety check
      try {
        const target = e.currentTarget as HTMLElement
        if (target && target.style) {
          target.style.transform = 'scale(0.95)'
        }
      } catch (error) {
        console.debug('Touch visual feedback error:', error)
      }
      
      // Execute custom callback
      onTouch?.()
    },
    onTouchEnd: (e: React.TouchEvent) => {
      // Reset visual state with safety check
      try {
        const target = e.currentTarget as HTMLElement
        if (target && target.style) {
          target.style.transform = ''
        }
      } catch (error) {
        console.debug('Touch visual reset error:', error)
      }
    },
    onTouchCancel: (e: React.TouchEvent) => {
      // Reset visual state if touch is cancelled with safety check
      try {
        const target = e.currentTarget as HTMLElement
        if (target && target.style) {
          target.style.transform = ''
        }
      } catch (error) {
        console.debug('Touch cancel reset error:', error)
      }
    }
  }
}