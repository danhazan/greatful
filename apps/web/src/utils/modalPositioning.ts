import type { RefObject } from "react"

const MARGIN = 16

export function openModalAboveButton<T extends HTMLElement>(
  buttonRef: RefObject<T | null>,
  config: { width: number; height: number },
  onPositionSet: (position: { x: number; y: number }) => void,
  onOpen: () => void
) {
  if (!buttonRef.current) return

  const rect = buttonRef.current.getBoundingClientRect()
  const viewportWidth = window.innerWidth

  // Center horizontally on the button
  const x = Math.max(
    MARGIN,
    Math.min(
      rect.left + rect.width / 2 - config.width / 2,
      viewportWidth - config.width - MARGIN
    )
  )

  // Position top of modal at top of button; CSS `bottom` places modal's bottom edge at button's top
  const fitsAbove = rect.top >= config.height + MARGIN

  if (fitsAbove) {
    onPositionSet({ x, y: rect.top })
    onOpen()
    return
  }

  const scrollAmount = config.height + MARGIN - rect.top
  window.scrollBy({ top: -scrollAmount, behavior: 'auto' })
  const newRect = buttonRef.current.getBoundingClientRect()
  onPositionSet({ x, y: newRect.top })
  onOpen()
}
