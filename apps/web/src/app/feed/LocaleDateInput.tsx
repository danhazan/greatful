import { useState, useEffect, useRef } from "react"
import { useLocale } from "@/hooks/useLocale"
import {
  isoToLocaleString,
  parseDateInputToISO,
  isValidISODate,
  getLocaleOrder,
  getLocalePlaceholder
} from "@/utils/dateFilterLocale"

interface LocaleDateInputProps {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  buttonPosition?: 'left' | 'right'
}

export default function LocaleDateInput({ value, onChange, min, max, buttonPosition = 'right' }: LocaleDateInputProps) {
  const locale = useLocale()
  const [inputValue, setInputValue] = useState(() => isoToLocaleString(value, locale))
  const datePickerRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setInputValue(isoToLocaleString(value, locale))
  }, [value, locale])

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value
    setInputValue(newVal)
    
    if (newVal.trim() === '') {
      onChange('')
      return
    }

    const isoCandidate = parseDateInputToISO(newVal, getLocaleOrder(locale))
    if (isValidISODate(isoCandidate)) {
      onChange(isoCandidate)
    }
  }

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value
    if (isValidISODate(iso)) {
      onChange(iso)
    }
    buttonRef.current?.focus()
  }

  const openPicker = () => {
    if (datePickerRef.current) {
      try {
        if (typeof datePickerRef.current.showPicker === 'function') {
          datePickerRef.current.showPicker()
        } else {
          datePickerRef.current.focus()
        }
      } catch {
        datePickerRef.current.focus()
      }
    }
  }

  const isoCandidate = parseDateInputToISO(inputValue, getLocaleOrder(locale))
  const isInvalid = inputValue.trim().length > 0 && !isValidISODate(isoCandidate)

  const calendarButton = (
    <button
      ref={buttonRef}
      onClick={openPicker}
      type="button"
      className="text-gray-500 hover:text-gray-700 pl-1 pr-0.5"
      aria-label="Open date picker"
    >
      <span aria-hidden="true">📅</span>
    </button>
  )

  return (
    <div className="relative">
      <div className="flex items-center gap-0">
        {buttonPosition === 'left' && calendarButton}
        <input 
          type="text" 
          value={inputValue} 
          onChange={handleTextChange}
          placeholder={getLocalePlaceholder(locale)}
          className={`rounded-lg border px-2 py-1 text-sm w-[110px] transition-colors ${
            isInvalid 
              ? 'border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
          }`}
        />
        {buttonPosition === 'right' && calendarButton}
        <input
          ref={datePickerRef}
          type="date"
          className="sr-only"
          tabIndex={-1}
          onChange={handlePickerChange}
          min={min}
          max={max}
        />
      </div>
      {isInvalid && (
        <span className="absolute text-[10px] text-red-500 -bottom-4 left-1 whitespace-nowrap">
          Invalid date
        </span>
      )}
    </div>
  )
}
