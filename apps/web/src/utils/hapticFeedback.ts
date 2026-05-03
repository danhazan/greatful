/**
 * Centralized haptic feedback utility
 * 
 * DESIGN DECISIONS:
 * 1. Centralization: All vibration logic flows through here to guarantee consistency
 *    across components and provide a single point of failure/configuration.
 * 2. Debounce: A 50ms guard prevents noisy, overlapping vibrations from rapid 
 *    double-clicks or hardware spam.
 * 3. Accessibility: Respects `prefers-reduced-motion` to support users sensitive
 *    to unexpected feedback or motion.
 */

let lastHapticTime = 0;

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  if (now - lastHapticTime < 50) return; // debounce (~1 frame)
  lastHapticTime = now;

  // Respect user preference for reduced motion/haptics
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  // Check if the device supports vibration
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return;
  }

  try {
    const pattern = type === 'light' ? 10 : type === 'medium' ? 20 : 30;
    navigator.vibrate(pattern);
    
    if (process.env.NODE_ENV === 'development') {
      // console.debug('[HAPTIC]', type);
    }
  } catch (error) {
    // Silently fail if vibration is not supported or blocked
    console.debug('Haptic feedback not available:', error);
  }
}