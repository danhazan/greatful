export const IMAGE_GALLERY_CONFIG = {
  // Zoom limits
  MIN_SCALE: 0.5,
  MAX_SCALE: 5.0,
  DEFAULT_SCALE: 1.0,

  // Double-tap settings
  DOUBLE_TAP_TARGET_SCALE: 2.0,

  // Button settings
  ZOOM_STEP: 0.5,

  // Wheel settings
  WHEEL_STEP: 0.001, // react-zoom-pan-pinch default is 0.05. Using a sensible default.

  // Tolerance for scale checks due to floating point and animation
  SCALE_TOLERANCE: 0.01,

  // Transition durations (ms)
  ANIMATION_DURATION: 200,
} as const;

/**
 * Helper to check if the current scale is effectively at default,
 * accounting for floating point imprecision.
 */
export function isAtDefaultScale(scale: number): boolean {
  return Math.abs(scale - IMAGE_GALLERY_CONFIG.DEFAULT_SCALE) < IMAGE_GALLERY_CONFIG.SCALE_TOLERANCE;
}
