/**
 * Utility functions for color manipulation and contrast calculation
 */

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculate the relative luminance of a color
 * Based on WCAG 2.1 guidelines
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Determine if a background color is dark
 * Returns true if the background is dark and should use white text
 */
export function isDarkBackground(backgroundColor: string): boolean {
  // Handle transparent backgrounds
  if (backgroundColor === 'transparent' || backgroundColor === '#ffffff' || backgroundColor === 'white') {
    return false;
  }

  // Handle named colors
  const namedColors: Record<string, string> = {
    'black': '#000000',
    'white': '#ffffff',
    'red': '#ff0000',
    'green': '#008000',
    'blue': '#0000ff',
    'yellow': '#ffff00',
    'cyan': '#00ffff',
    'magenta': '#ff00ff',
    'gray': '#808080',
    'grey': '#808080',
    'darkgray': '#a9a9a9',
    'darkgrey': '#a9a9a9',
    'lightgray': '#d3d3d3',
    'lightgrey': '#d3d3d3'
  };

  let hexColor = backgroundColor;
  if (namedColors[backgroundColor.toLowerCase()]) {
    hexColor = namedColors[backgroundColor.toLowerCase()];
  }

  // Convert to RGB
  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    // If we can't parse the color, assume it's light
    return false;
  }

  // Calculate luminance
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  
  // If luminance is less than 0.5, it's considered dark
  // This threshold can be adjusted based on design preferences
  return luminance < 0.5;
}

/**
 * Get the appropriate text color for a given background
 * Returns white for dark backgrounds, default text color for light backgrounds
 */
export function getTextColorForBackground(backgroundColor: string, defaultTextColor: string = '#374151'): string {
  return isDarkBackground(backgroundColor) ? '#ffffff' : defaultTextColor;
}

/**
 * Extract the primary background color from a gradient or solid color
 * For gradients, returns the first color
 */
export function extractPrimaryBackgroundColor(background: string): string {
  // Handle gradients - extract the first color
  if (background.includes('linear-gradient') || background.includes('radial-gradient')) {
    // Match hex colors in the gradient
    const hexMatch = background.match(/#[a-fA-F0-9]{6}/);
    if (hexMatch) {
      return hexMatch[0];
    }
    
    // Match rgb/rgba colors in the gradient
    const rgbMatch = background.match(/rgba?\([^)]+\)/);
    if (rgbMatch) {
      return rgbMatch[0];
    }
  }
  
  // Return the background as-is if it's a solid color
  return background;
}