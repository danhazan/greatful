'use client'

import { createContext, useContext, useRef, useEffect, useCallback } from 'react'

type PortalRef = { current: HTMLElement | null }

interface ModalPortalRefContextValue {
  registerRef: (ref: PortalRef) => () => void
  getAllRefs: () => PortalRef[]
}

const ModalPortalRefContext = createContext<ModalPortalRefContextValue>({
  registerRef: () => () => {},
  getAllRefs: () => [],
})

export function ModalPortalRefProvider({ children }: { children: React.ReactNode }) {
  const refsRef = useRef<PortalRef[]>([])

  const registerRef = useCallback((ref: PortalRef) => {
    refsRef.current = [...refsRef.current, ref]
    return () => {
      refsRef.current = refsRef.current.filter((r) => r !== ref)
    }
  }, [])

  const getAllRefs = useCallback(() => refsRef.current, [])

  return (
    <ModalPortalRefContext.Provider value={{ registerRef, getAllRefs }}>
      {children}
    </ModalPortalRefContext.Provider>
  )
}

export function useModalPortalRefs() {
  return useContext(ModalPortalRefContext)
}
