/**
 * Centralized haptic feedback utility
 */

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  // Check if the device supports vibration
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return;
  }

  const vibrationMap: Record<'light' | 'medium' | 'heavy', number> = {
    light: 10,
    medium: 20,
    heavy: 30
  };

  try {
    navigator.vibrate(vibrationMap[type]);
  } catch (error) {
    // Silently fail if vibration is not supported or blocked
    console.debug('Haptic feedback not available:', error);
  }
}