/**
 * Shared input styling utilities to fix transparent text issues on mobile devices
 * 
 * The transparent text issue occurs when mobile browsers apply autofill styling
 * that can make text invisible. This utility provides consistent styling to ensure
 * text is always visible across all input types.
 */

import { CSSProperties } from 'react'

/**
 * Base input styles that ensure text visibility on all devices
 * Fixes the transparent text issue that occurs on mobile browsers
 */
export const getVisibleTextInputStyles = (): CSSProperties => ({
  // Ensure text is always visible
  color: '#374151', // gray-700
  // DESIGN RULE: Background is NOT owned by this utility.
  // This utility handles ONLY text visibility and caret styling for WebKit autofill.
  // Background MUST be defined exclusively by bg-* classes or component layout.
  // Every consumer must include an explicit bg-* class unless intentionally transparent.
  // Reason: inline backgroundColor overrides the bg-* class. Removing it here ensures
  // background authority stays with layout/context classes, which is the project pattern.
  
  // Fix mobile text positioning issues
  WebkitUserSelect: 'text',
  userSelect: 'text',
  WebkitTouchCallout: 'default',
  WebkitTapHighlightColor: 'transparent',
  
  // Ensure proper text positioning on mobile
  // ponytail: visual default, not the bug fix. Auto-resize textareas reading
  // getComputedStyle(lineHeight) override with lineHeight:undefined in JSDOM.
  lineHeight: '1.5',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  
  // Fix iOS Safari text positioning and autofill issues
  WebkitTextSizeAdjust: '100%',
  WebkitTextFillColor: '#374151', // Prevents autofill from making text transparent
  
  // Ensure caret is visible
  caretColor: '#374151'
})

/**
 * Tailwind classes that complement the inline styles for consistent input styling
 */
export const VISIBLE_TEXT_INPUT_CLASSES = 'text-gray-700 placeholder-gray-400'

/**
 * Complete input styling solution combining both inline styles and classes
 */
export const getCompleteInputStyling = () => ({
  style: getVisibleTextInputStyles(),
  className: VISIBLE_TEXT_INPUT_CLASSES
})