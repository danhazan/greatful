/**
 * Extract a human-readable error message from structured API error payloads.
 *
 * Handles FastAPI/Pydantic 422 validation detail arrays, plain string detail,
 * message/error fields, and any combination. Returns fallback if nothing matches.
 */
export function extractErrorMessage(errorData: any, fallback: string): string {
  if (!errorData || typeof errorData !== 'object') return fallback
  const detail = errorData.detail
  if (Array.isArray(detail)) {
    return detail.map((err: any) => {
      if (typeof err === 'string') return err
      if (typeof err === 'object' && err !== null) {
        return err.msg || err.message || JSON.stringify(err)
      }
      return String(err)
    }).join(', ')
  }
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail !== null) {
    return detail.message || JSON.stringify(detail)
  }
  if (typeof errorData.message === 'string') return errorData.message
  if (typeof errorData.error === 'string') return errorData.error
  return fallback
}
