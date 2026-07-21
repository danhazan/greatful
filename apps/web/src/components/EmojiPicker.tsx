"use client"

import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { X, Heart, Smile, Hand, Flower } from "lucide-react"
import { 
  composeCompactRow,
  ReactionGroup,
  VALID_GROUPS,
  REACTION_INVENTORY,
  POPULAR_BY_GROUP
} from "@/generated/reactions"
import { triggerHaptic } from "@/utils/hapticFeedback"
import { useModal } from "@/hooks/useModal"
import { useRecentReactions } from "@/hooks/useRecentReactions"

interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onCancel: () => void
  onEmojiSelect: (emojiCode: string) => void
  currentReaction?: string | null
  triggerRef: React.RefObject<HTMLElement>
  isLoading?: boolean
}

const GROUP_ICONS: Record<ReactionGroup, typeof Heart> = { heart: Heart, face: Smile, hands: Hand, misc: Flower }
const GROUP_LABELS: Record<ReactionGroup, string> = { heart: 'Heart', face: 'Face', hands: 'Hands', misc: 'Misc' }

export default function EmojiPicker({
  isOpen,
  onClose,
  onCancel,
  onEmojiSelect,
  currentReaction,
  triggerRef,
  isLoading = false,
}: EmojiPickerProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const hasPositionedRef = useRef(false)
  const [activeGroup, setActiveGroup] = useState<ReactionGroup | null>(null)

  const { recentReactions, addRecentReaction } = useRecentReactions()

  const isScrollingRef = useRef(false)
  const touchStartRef = useRef({ x: 0, y: 0 })

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
    isScrollingRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x)
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y)
    if (dx > 10 || dy > 10) {
      isScrollingRef.current = true
    }
  }

  useEffect(() => {
    if (isOpen) {
      setSelectedEmoji(null)
      setActiveGroup(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setVisible(false)
      hasPositionedRef.current = false
    }
  }, [isOpen])

  const isExpanded = activeGroup !== null

  useLayoutEffect(() => {
    if (!isOpen) return
    if (hasPositionedRef.current) return
    if (!triggerRef.current || !modalRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const modalRect = modalRef.current.getBoundingClientRect()

    const MARGIN = 16
    const GAP = 8

    const triggerCenter = triggerRect.left + triggerRect.width / 2
    const left = Math.max(
      MARGIN,
      Math.min(triggerCenter - modalRect.width / 2, window.innerWidth - modalRect.width - MARGIN)
    )

    const spaceBelow = window.innerHeight - triggerRect.bottom - GAP
    const spaceAbove = triggerRect.top - GAP
    let top: number
    if (spaceBelow >= modalRect.height + MARGIN) {
      top = triggerRect.bottom + GAP
    } else if (spaceAbove >= modalRect.height + MARGIN) {
      top = triggerRect.top - modalRect.height - GAP
    } else {
      top = Math.max(
        MARGIN,
        Math.min(triggerRect.bottom + GAP, window.innerHeight - modalRect.height - MARGIN)
      )
    }

    setPosition({ left, top })
    setVisible(true)
    hasPositionedRef.current = true
  }, [isOpen, triggerRef, isExpanded])

  useModal(modalRef, isOpen, onCancel, { enableTabTrap: true })

  const currentGroupEmojis = useMemo(() => {
    if (!activeGroup) return []
    return REACTION_INVENTORY.filter(item => item.group === activeGroup)
  }, [activeGroup])

  const compactRows = useMemo(() => {
    return VALID_GROUPS.map(group => {
      const codes = composeCompactRow(recentReactions[group] || [], POPULAR_BY_GROUP[group] || [], 4)
      return codes.map(code => REACTION_INVENTORY.find(r => r.code === code)!)
    })
  }, [recentReactions])

  const handleEmojiClick = useCallback((emojiCode: string) => {
    if (isLoading) return
    if (currentReaction === emojiCode) {
      onCancel()
      return
    }
    triggerHaptic('light')
    setSelectedEmoji(emojiCode)
    
    const reactionItem = REACTION_INVENTORY.find(item => item.code === emojiCode)
    if (reactionItem) {
      addRecentReaction(reactionItem.group as ReactionGroup, emojiCode)
    }

    onEmojiSelect(emojiCode)
    onClose()
  }, [isLoading, currentReaction, onCancel, onEmojiSelect, onClose, addRecentReaction])

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  const handleXButtonClick = () => onCancel()

  const renderCompactRow = (group: ReactionGroup, index: number) => {
    const items = compactRows[index]
    const Icon = GROUP_ICONS[group]
    return (
      <div key={group} className="flex items-center mb-1 last:mb-0">
        <div className="flex items-center space-x-1 flex-1 min-w-0 overflow-hidden">
          {items.map(item => (
            <button
              key={item.code}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isScrollingRef.current) return
                handleEmojiClick(item.code)
              }}
              disabled={isLoading}
              className={`
                relative p-2 rounded-full transition-transform hover:scale-110 active:scale-95
                flex-1 flex items-center justify-center text-2xl min-w-0
                ${currentReaction === item.code ? 'bg-purple-100 ring-2 ring-purple-500 ring-offset-1' : 'hover:bg-gray-50'}
                ${selectedEmoji === item.code ? 'bg-purple-200' : ''}
              `}
              title={item.label}
              aria-label={`React with ${item.label}`}
              aria-pressed={currentReaction === item.code}
            >
              <span className="block pointer-events-none">{item.character}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setActiveGroup(group)}
          className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-purple-100 hover:text-purple-600 transition-colors flex-shrink-0 ml-1"
          aria-label={`Show all ${GROUP_LABELS[group]} emojis`}
          title={GROUP_LABELS[group]}
        >
          <Icon className="w-4 h-4" />
        </button>
      </div>
    )
  }

  const renderGroupButton = (group: ReactionGroup) => {
    const Icon = GROUP_ICONS[group]
    const isActive = activeGroup === group
    return (
      <button
        key={group}
        onClick={() => setActiveGroup(group)}
        className={`p-2 rounded-lg transition-colors ${
          isActive ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'
        }`}
        aria-label={GROUP_LABELS[group]}
        title={GROUP_LABELS[group]}
      >
        <Icon className="w-5 h-5" />
      </button>
    )
  }

  const contentHeight = '200px'

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-20 z-[80]"
        data-emoji-picker
        style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        onClick={onCancel}
      />

      <div
        ref={modalRef}
        data-emoji-picker
        role="dialog"
        aria-modal="true"
        aria-label="Emoji picker"
        className="fixed z-[81] bg-white rounded-xl shadow-xl border border-gray-100 flex flex-col"
        style={{
          left: position.left,
          top: position.top,
          visibility: visible ? 'visible' : 'hidden',
          pointerEvents: visible ? 'auto' : 'none',
          padding: '12px',
          width: '320px',
        }}
        tabIndex={-1}
      >
        <div className="flex justify-between items-center mb-2 flex-shrink-0">
          <div className="flex space-x-1">
            {VALID_GROUPS.map(renderGroupButton)}
          </div>
          <button
            onClick={handleXButtonClick}
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none rounded-full p-1 ml-2"
            aria-label="Close emoji picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          ref={activeGroup ? scrollContainerRef : undefined}
          data-allow-scroll={activeGroup ? 'true' : undefined}
          className={activeGroup
            ? 'overflow-y-auto overflow-x-hidden p-1 border-t border-gray-100 pt-3'
            : 'flex flex-col justify-center p-1 border-t border-gray-100 pt-3'
          }
          style={{
            height: contentHeight,
            overscrollBehavior: 'contain',
            scrollbarWidth: 'none',
          }}
        >
          {!activeGroup && (
            <div className="flex flex-col justify-center h-full">
              {VALID_GROUPS.map((group, i) => renderCompactRow(group, i))}
            </div>
          )}

          {activeGroup && (
            <div
              className="grid grid-cols-6 gap-2"
              role="grid"
              aria-label={`${GROUP_LABELS[activeGroup]} emoji reactions`}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
            >
              {currentGroupEmojis.map((item) => (
                <div key={item.code} role="gridcell">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (isScrollingRef.current) return
                      handleEmojiClick(item.code)
                    }}
                    disabled={isLoading}
                    className={`
                      relative p-2 rounded-lg transition-transform hover:scale-110 active:scale-95
                      w-full aspect-square flex items-center justify-center text-2xl
                      ${currentReaction === item.code ? 'bg-purple-100 ring-1 ring-purple-500' : 'hover:bg-gray-50'}
                      ${selectedEmoji === item.code ? 'bg-purple-200' : ''}
                    `}
                    title={item.label}
                    aria-label={`React with ${item.label}`}
                    aria-pressed={currentReaction === item.code}
                  >
                    <span className="block pointer-events-none">{item.character}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
