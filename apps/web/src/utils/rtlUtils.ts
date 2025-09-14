/**
 * RTL (Right-to-Left) text utilities for Hebrew, Arabic, and other RTL languages
 */

// Unicode ranges for RTL languages
const RTL_RANGES = [
  [0x0590, 0x05FF], // Hebrew
  [0x0600, 0x06FF], // Arabic
  [0x0700, 0x074F], // Syriac
  [0x0780, 0x07BF], // Thaana
  [0x08A0, 0x08FF], // Arabic Extended-A
  [0xFB1D, 0xFB4F], // Hebrew Presentation Forms
  [0xFB50, 0xFDFF], // Arabic Presentation Forms-A
  [0xFE70, 0xFEFF], // Arabic Presentation Forms-B
];

/**
 * Detects if a character is from an RTL script
 */
export function isRTLCharacter(char: string): boolean {
  const codePoint = char.codePointAt(0);
  if (!codePoint) return false;
  
  return RTL_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

/**
 * Detects if text contains RTL characters
 */
export function hasRTLCharacters(text: string): boolean {
  if (!text) return false;
  
  for (const char of text) {
    if (isRTLCharacter(char)) {
      return true;
    }
  }
  return false;
}

/**
 * Determines the primary text direction of a string
 * Returns 'rtl' if RTL characters make up more than 10% of the text,
 * otherwise returns 'ltr'
 */
export function getTextDirection(text: string): 'ltr' | 'rtl' {
  if (!text) return 'ltr';
  
  let rtlCount = 0;
  let totalChars = 0;
  
  for (const char of text) {
    // Skip whitespace and punctuation for direction calculation
    if (/\s|[.,!?;:]/.test(char)) continue;
    
    totalChars++;
    if (isRTLCharacter(char)) {
      rtlCount++;
    }
  }
  
  if (totalChars === 0) return 'ltr';
  
  // If more than 10% of characters are RTL, consider the text RTL
  // This handles mixed content better
  return (rtlCount / totalChars) > 0.1 ? 'rtl' : 'ltr';
}

/**
 * Improved text direction detection for plain text (no markup)
 * More robust for DOM-parsed content
 * Uses lower threshold for RTL detection to handle mixed content better
 */
export function getTextDirectionFromPlainText(plain: string): 'ltr' | 'rtl' {
  if (!plain) return 'ltr';
  
  let rtlCount = 0;
  let total = 0;
  
  for (const ch of plain) {
    // Skip whitespace, punctuation, and bidi markers
    if (/\s|[.,!?;:()"'\u200E\u200F]/.test(ch)) continue;
    total++;
    if (isRTLCharacter(ch)) rtlCount++;
  }
  
  if (total === 0) return 'ltr';
  
  // Use lower threshold (10%) for RTL detection to handle mixed content
  // If there's any significant RTL presence, treat as RTL
  return (rtlCount / total) > 0.1 ? 'rtl' : 'ltr';
}

/**
 * Gets the appropriate text alignment class based on text direction
 */
export function getTextAlignmentClass(text: string): string {
  const direction = getTextDirection(text);
  return direction === 'rtl' ? 'text-right' : 'text-left';
}

/**
 * Gets the appropriate direction attribute for HTML elements
 */
export function getDirectionAttribute(text: string): 'ltr' | 'rtl' {
  return getTextDirection(text);
}

/**
 * Detects if text contains mixed LTR/RTL content
 */
export function hasMixedDirectionContent(text: string): boolean {
  if (!text) return false;
  
  let hasLTR = false;
  let hasRTL = false;
  
  for (const char of text) {
    if (/[a-zA-Z]/.test(char)) {
      hasLTR = true;
    } else if (isRTLCharacter(char)) {
      hasRTL = true;
    }
    
    // Early exit if we found both
    if (hasLTR && hasRTL) {
      return true;
    }
  }
  
  return false;
}

/**
 * Gets CSS classes for RTL-aware spacing
 */
export function getRTLAwareSpacingClasses(text: string): {
  marginStart: string;
  marginEnd: string;
  paddingStart: string;
  paddingEnd: string;
} {
  const isRTL = getTextDirection(text) === 'rtl';
  
  return {
    marginStart: isRTL ? 'mr-2' : 'ml-2',
    marginEnd: isRTL ? 'ml-2' : 'mr-2',
    paddingStart: isRTL ? 'pr-2' : 'pl-2',
    paddingEnd: isRTL ? 'pl-2' : 'pr-2',
  };
}