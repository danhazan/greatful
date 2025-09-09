"use client"

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Bold, Italic, Underline, Type, Palette, Smile } from "lucide-react"
import { sanitizeHtml } from "@/utils/htmlUtils"
import { wrapMentions, mentionsToPlainText } from "@/utils/mentions"
import EnhancedEmojiPicker from "./EnhancedEmojiPicker"

export interface RichTextEditorRef {
  getHtml: () => string
  getPlainText: () => string
  focus: () => void
  insertMention: (username: string, mentionStart: number, mentionEnd: number) => void
  clear: () => void
}

interface RichTextEditorProps {
  value?: string // plain fallback or initial plain text
  htmlValue?: string | null // initial formatted HTML (preferred)
  placeholder?: string
  onChange?: (plainText: string, formattedHtml: string) => void
  className?: string
  maxLength?: number
  onMentionTrigger?: (query: string, position: { x: number, y: number }, cursorPosition?: number) => void
  onMentionHide?: () => void
  selectedStyle?: any
  onStyleChange?: (style: any) => void
}

const TEXT_COLORS = [
  { name: 'Default', value: '#374151' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Green', value: '#059669' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Pink', value: '#DB2777' },
  { name: 'Indigo', value: '#4F46E5' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Yellow', value: '#D97706' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Lime', value: '#84CC16' }
]

const BACKGROUND_COLORS = [
  { name: 'None', value: 'transparent' },
  { name: 'Light Purple', value: '#F3F4F6' },
  { name: 'Light Blue', value: '#EFF6FF' },
  { name: 'Light Green', value: '#ECFDF5' },
  { name: 'Light Orange', value: '#FFF7ED' },
  { name: 'Light Pink', value: '#FDF2F8' },
  { name: 'Light Yellow', value: '#FEFCE8' },
  { name: 'Light Gray', value: '#F9FAFB' },
  { name: 'Light Red', value: '#FEF2F2' },
  { name: 'Light Indigo', value: '#EEF2FF' },
  { name: 'Light Teal', value: '#F0FDFA' },
  { name: 'Light Cyan', value: '#ECFEFF' },
  { name: 'Light Rose', value: '#FFF1F2' },
  { name: 'Light Violet', value: '#F5F3FF' },
  { name: 'Light Amber', value: '#FFFBEB' },
  { name: 'Light Lime', value: '#F7FEE7' }
]

// Utility functions for range-based mention handling
function getNodeForCharacterOffset(root: HTMLElement, index: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let current = walker.nextNode() as Text | null;
  let accumulated = 0;
  
  while (current) {
    const len = (current.textContent || "").length;
    if (accumulated + len >= index) {
      return { node: current, offset: Math.max(0, index - accumulated) };
    }
    accumulated += len;
    current = walker.nextNode() as Text | null;
  }
  
  // If index is at or beyond end, return null to handle it in caller
  return null;
}

function getPlainText(root: HTMLElement): string {
  // Uses Range.toString() so it matches how browsers produce visible text
  const range = document.createRange();
  range.selectNodeContents(root);
  return range.toString();
}

function getTextUpToCursor(root: HTMLElement): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return "";
  
  const range = document.createRange();
  try {
    range.setStart(root, 0);
    const selRange = selection.getRangeAt(0);
    range.setEnd(selRange.endContainer, selRange.endOffset);
    return range.toString();
  } catch (e) {
    // fallback: last resort try anchorNode approach
    const anchorNode = selection.anchorNode;
    return anchorNode ? (anchorNode.textContent || "").slice(0, selection.anchorOffset) : "";
  }
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  value = "",
  htmlValue = null,
  placeholder = "What are you grateful for?",
  onChange,
  className = "",
  maxLength = 5000,
  onMentionTrigger,
  onMentionHide,
  selectedStyle,
  onStyleChange
}, ref) => {
  const editableRef = useRef<HTMLDivElement | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 })
  
  // Prevent controlled component race conditions
  const typingRef = useRef(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initializedRef = useRef(false)

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Initialize contentEditable with incoming HTML (if present) else plain text
  useEffect(() => {
    if (!editableRef.current) return

    // CRITICAL FIX: Don't overwrite content while user is typing
    // This prevents the backwards text bug caused by controlled component race conditions
    if (typingRef.current) {
      return;
    }

    // Only set initial content once when mounting to avoid overwriting user input
    if (!initializedRef.current) {
      if (htmlValue) {
        // Sanitize & preserve mention spans
        editableRef.current.innerHTML = sanitizeHtml(htmlValue)
      } else {
        // If only plain text provided, escape & set
        editableRef.current.textContent = value || ""
      }
      initializedRef.current = true;
    } else {
      // For subsequent updates, only update if content is significantly different
      // This prevents minor typing changes from triggering content overwrites
      const currentText = editableRef.current.textContent || "";
      const newText = value || "";
      
      if (Math.abs(currentText.length - newText.length) > 5) {
        if (htmlValue) {
          editableRef.current.innerHTML = sanitizeHtml(htmlValue)
        } else {
          editableRef.current.textContent = newText
        }
      }
    }
  }, [htmlValue, value])

  const emitChange = () => {
    if (!editableRef.current || isComposing) return
    
    const rawHtml = editableRef.current.innerHTML
    const clean = sanitizeHtml(rawHtml)
    const plain = mentionsToPlainText(clean)
    
    onChange?.(plain, clean)
  }

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    getHtml: () => {
      const raw = editableRef.current?.innerHTML ?? ""
      return sanitizeHtml(raw)
    },
    getPlainText: () => {
      // Use mention helper to convert mention spans to plain text
      const raw = editableRef.current?.innerHTML ?? ""
      return mentionsToPlainText(raw)
    },
    focus: () => editableRef.current?.focus(),
    insertMention: (username: string, mentionStart: number, mentionEnd: number) => {
      if (!editableRef.current) return

      // Temporarily allow programmatic updates
      const wasTyping = typingRef.current;
      typingRef.current = false;

      try {
        const root = editableRef.current;
        // Compute the actual plain text length and clamp indices
        const fullText = getPlainText(root);
        const startIndex = Math.max(0, Math.min(mentionStart, fullText.length));
        const endIndex = Math.max(0, Math.min(mentionEnd, fullText.length));

        // Map indices to text nodes
        const startNodeInfo = getNodeForCharacterOffset(root, startIndex);
        const endNodeInfo = getNodeForCharacterOffset(root, endIndex);

        // Build a range that covers the mention text and replace it
        const range = document.createRange();
        if (startNodeInfo) {
          range.setStart(startNodeInfo.node, startNodeInfo.offset);
        } else {
          // fallback: start at end of root
          range.setStart(root, root.childNodes.length);
        }

        if (endNodeInfo) {
          range.setEnd(endNodeInfo.node, endNodeInfo.offset);
        } else {
          range.setEnd(root, root.childNodes.length);
        }

        // Get the text that will be replaced to check if it includes @
        const rangeText = range.toString();
        const includesAtSymbol = rangeText.includes('@');

        // Delete the matched content
        range.deleteContents();

        // Create mention span
        const mentionSpan = document.createElement("span");
        mentionSpan.className = "mention";
        mentionSpan.setAttribute("data-username", username);
        mentionSpan.setAttribute("contenteditable", "false"); // prevents caret entering the mention
        
        // The mention span should always show @username, regardless of what was replaced
        mentionSpan.textContent = `@${username}`;

        // Insert mention at range
        range.insertNode(mentionSpan);

        // Insert a single space after the mention for normal typing
        const spaceNode = document.createTextNode(" "); // regular space
        mentionSpan.parentNode?.insertBefore(spaceNode, mentionSpan.nextSibling);

        // Place caret after the inserted space
        const sel = window.getSelection();
        const newRange = document.createRange();
        newRange.setStartAfter(spaceNode);
        newRange.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(newRange);

        // Emit change to update post data
        emitChange();
      } catch (err) {
        console.error("insertMention error", err);
      } finally {
        typingRef.current = wasTyping;
        setTimeout(() => editableRef.current?.focus(), 0);
      }
    },
    clear: () => {
      if (!editableRef.current) return
      
      // Force clear the editor content
      editableRef.current.innerHTML = ''
      editableRef.current.textContent = ''
      
      // Reset initialization flag so next value prop will be applied
      initializedRef.current = false
      
      // Emit change to notify parent
      emitChange()
    }
  }), [])

  // Composition events for IME support
  const handleCompositionStart = () => {
    setIsComposing(true)
  }
  
  const handleCompositionEnd = () => { 
    setIsComposing(false) 
    emitChange() 
  }

  const handleInput = () => {
    if (!editableRef.current) return
    
    // Set typing flag to prevent external overwrites during user input
    typingRef.current = true;
    
    // Clear previous timeout and set new one
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingRef.current = false;
    }, 500);
    
    // Always enforce LTR direction to prevent backwards text
    editableRef.current.dir = 'ltr'
    editableRef.current.style.direction = 'ltr'
    editableRef.current.style.textAlign = 'left'
    
    // Enhanced mention detection using range-based approach
    if (onMentionTrigger || onMentionHide) {
      try {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0 && selection.anchorNode) {
          // Check if cursor is inside a mention span (improved logic)
          let currentNode: Node | null = selection.anchorNode
          let isInsideMentionSpan = false
          
          while (currentNode && currentNode !== editableRef.current) {
            if (currentNode.nodeType === Node.ELEMENT_NODE &&
                (currentNode as Element).classList?.contains('mention')) {
              // if selection.anchorNode is the mention's text node and the anchorOffset < textLength,
              // then we are inside mention. If anchorOffset is at end, it's after mention: don't hide.
              const mentionEl = currentNode as Element;
              const textNode = mentionEl.firstChild;
              if (textNode && selection.anchorNode === textNode) {
                const offset = selection.anchorOffset || 0;
                if (offset < (textNode.textContent || "").length) {
                  isInsideMentionSpan = true;
                }
              } else {
                // if anchorNode is the mention element itself, assume inside only if offset within it
                isInsideMentionSpan = true;
              }
              break;
            }
            currentNode = currentNode.parentNode
          }
          
          // If we're inside a mention span, hide the dropdown and return
          if (isInsideMentionSpan) {
            onMentionHide?.();
            return;
          }
          
          // Use range-based text extraction for robust mention detection
          const textUpToCursor = getTextUpToCursor(editableRef.current);
          const mentionMatch = textUpToCursor.match(/@([a-zA-Z0-9_\-\.\?\!\+]*)$/);
          
          if (mentionMatch && onMentionTrigger) {
            const cursorPosition = textUpToCursor.length;
            const rect = editableRef.current.getBoundingClientRect();
            onMentionTrigger(mentionMatch[1] || '', { x: rect.left + 16, y: rect.bottom + 8 }, cursorPosition);
          } else if (!mentionMatch && onMentionHide) {
            onMentionHide();
          }
        }
      } catch (error) {
        // If mention detection fails, just continue with normal input
        console.warn('Mention detection error:', error)
      }
    }
    
    emitChange()
  }

  // Toolbar helpers (simple execCommand wrappers)
  const exec = (command: string, value?: string) => {
    // Check if execCommand is available (not available in test environments)
    if (typeof document.execCommand === 'function') {
      // Force CSS styling mode to prevent direction issues
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand(command, false, value)
    }
    
    // Ensure LTR direction is maintained after formatting
    if (editableRef.current) {
      editableRef.current.dir = 'ltr'
      editableRef.current.style.direction = 'ltr'
      editableRef.current.style.textAlign = 'left'
    }
    
    emitChange()
    editableRef.current?.focus()
  }

  const insertEmoji = (emoji: string) => {
    if (!editableRef.current) return

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(emoji))
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      // Fallback: append to end
      editableRef.current.appendChild(document.createTextNode(emoji))
    }
    
    emitChange()
    editableRef.current.focus()
  }

  return (
    <div className={`rich-editor ${className || ""}`}>
      <div className="toolbar mb-2 flex flex-wrap items-center gap-2 p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        {/* Text Formatting */}
        <div className="flex items-center gap-1">
          <button 
            type="button" 
            onMouseDown={(e)=>e.preventDefault()} 
            onClick={() => exec('bold')}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600"
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button 
            type="button" 
            onMouseDown={(e)=>e.preventDefault()} 
            onClick={() => exec('italic')}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600"
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button 
            type="button" 
            onMouseDown={(e)=>e.preventDefault()} 
            onClick={() => exec('underline')}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600"
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </button>
        </div>

        <div className="hidden sm:block w-px h-6 bg-gray-300" />

        {/* Color Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowColorPicker(!showColorPicker)
            }}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600"
            title="Text Color"
          >
            <Type className="h-4 w-4" />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50" data-rich-text-modal>
              <div className="grid grid-cols-6 gap-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onMouseDown={(e)=>e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      exec('foreColor', color.value)
                      setShowColorPicker(false)
                    }}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Background Color Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowBackgroundPicker(!showBackgroundPicker)
            }}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600"
            title="Background Color"
          >
            <Palette className="h-4 w-4" />
          </button>
          {showBackgroundPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50" data-rich-text-modal>
              <div className="grid grid-cols-6 gap-1">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onMouseDown={(e)=>e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      exec('backColor', color.value === 'transparent' ? '#ffffff' : color.value)
                      setShowBackgroundPicker(false)
                    }}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ 
                      backgroundColor: color.value === 'transparent' ? '#ffffff' : color.value,
                      border: color.value === 'transparent' ? '2px dashed #d1d5db' : '1px solid #d1d5db'
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:block w-px h-6 bg-gray-300" />

        {/* Emoji Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              setEmojiPickerPosition({ x: rect.left, y: rect.bottom + 8 })
              setShowEmojiPicker(!showEmojiPicker)
            }}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600"
            title="Add Emoji"
          >
            <Smile className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ContentEditable Editor */}
      <div
        ref={editableRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        className="min-h-[120px] p-3 border rounded-b-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
        data-placeholder={placeholder}
        dir="ltr"
        style={{
          minHeight: '120px',
          maxHeight: '300px',
          overflowY: 'auto',
          direction: 'ltr',
          textAlign: 'left'
        } as React.CSSProperties}
      />

      {/* Click outside handlers */}
      {(showColorPicker || showBackgroundPicker) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowColorPicker(false)
            setShowBackgroundPicker(false)
          }}
        />
      )}

      {/* Enhanced Emoji Picker */}
      <EnhancedEmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={insertEmoji}
        position={emojiPickerPosition}
      />

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .mention {
          background-color: #e0e7ff;
          color: #3730a3;
          padding: 2px 4px;
          border-radius: 4px;
          font-weight: 500;
        }
      `}</style>
    </div>
  )
})

RichTextEditor.displayName = 'RichTextEditor'

export default RichTextEditor