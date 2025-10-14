import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { getCompleteInputStyling } from "@/utils/inputStyles"

interface PasswordInputProps {
  id: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  required?: boolean
  className?: string
  autoComplete?: string
  label?: string
  error?: string
  children?: React.ReactNode // For additional content like "Forgot password?" link
  minLength?: number
  helperText?: string
}

export default function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder = "Enter your password",
  required = false,
  className = "",
  autoComplete = "current-password",
  label = "Password",
  error,
  children,
  minLength,
  helperText
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  const baseClassName = `w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${getCompleteInputStyling().className} ${className}`

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className={baseClassName}
          style={getCompleteInputStyling().style}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5 text-gray-400" />
          ) : (
            <Eye className="h-5 w-5 text-gray-400" />
          )}
        </button>
      </div>
      {helperText && (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      )}
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  )
}