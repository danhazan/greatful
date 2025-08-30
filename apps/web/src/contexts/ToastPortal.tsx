"use client"

import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export default function ToastPortal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    // Reuse existing #toast-root or create once
    let el = document.getElementById("toast-root") as HTMLElement | null
    if (!el) {
      el = document.createElement("div")
      el.id = "toast-root"
      // Hard-kill any stacking/overflow issues from ancestors
      Object.assign(el.style, {
        position: "fixed",
        top: "0",
        right: "0",
        zIndex: String(2147483647), // max int-ish
        pointerEvents: "none",
      })
      document.body.appendChild(el)
    }
    setTarget(el)
  }, [])

  if (!target) return null
  return createPortal(children, target)
}