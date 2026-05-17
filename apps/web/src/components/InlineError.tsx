interface InlineErrorProps {
  message: string | null
}

export default function InlineError({ message }: InlineErrorProps) {
  if (!message) return null

  return (
    <div className="px-6 pb-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <p className="text-sm text-red-600">{message}</p>
      </div>
    </div>
  )
}
