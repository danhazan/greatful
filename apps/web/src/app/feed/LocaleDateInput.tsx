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
}

export default function LocaleDateInput({ value, onChange, min, max }: LocaleDateInputProps) {
  const locale = useLocale()
  const [inputValue, setInputValue] = useState(() => isoToLocaleString(value, locale))
  const datePickerRef = useRef<HTMLInputElement>(null)

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
  }

  const openPicker = () => {
    if (datePickerRef.current) {
      try {
        if (typeof datePickerRef.current.showPicker === 'function') {
          datePickerRef.current.showPicker()
        } else if (typeof datePickerRef.current.click === 'function') {
          datePickerRef.current.click()
        } else {
          datePickerRef.current.focus()
        }
      } catch (err) {
        datePickerRef.current.focus()
      }
    }
  }

  const isoCandidate = parseDateInputToISO(inputValue, getLocaleOrder(locale))
  const isInvalid = inputValue.trim().length > 0 && !isValidISODate(isoCandidate)

  return (
    <div className="relative flex items-center">
      <input 
        type="text" 
        value={inputValue} 
        onChange={handleTextChange}
        placeholder={getLocalePlaceholder(locale)}
        className={`rounded-lg border px-2 py-1 text-sm w-[130px] transition-colors ${
          isInvalid 
            ? 'border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500' 
            : 'border-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
        }`}
      />
      {isInvalid && (
        <span className="absolute text-[10px] text-red-500 -bottom-4 left-1 whitespace-nowrap">
          Invalid date
        </span>
      )}
      <button 
        onClick={openPicker} 
        type="button"
        className="absolute right-2 text-gray-500 hover:text-gray-700"
        aria-label="Open date picker"
      >
        📅
      </button>
      
      <input
        ref={datePickerRef}
        type="date"
        className="sr-only"
        onChange={handlePickerChange}
        min={min}
        max={max}
      />
    </div>
  )
}
