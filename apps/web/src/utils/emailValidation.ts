export interface EmailValidationResult {
  valid: boolean
  message: string | null
}

/**
 * Frontend email normalization — strips surrounding whitespace only.
 *
 * This is NOT RFC email canonicalization. It trims whitespace to match
 * what the backend InputSanitizer does before the email reaches Pydantic
 * EmailStr. Lowercasing is intentionally omitted — the backend preserves
 * original case in storage and uses case-insensitive lookups.
 */
export function normalizeEmail(email: string): string {
  return email.trim()
}

/**
 * Frontend email validation — practical UX rules, not RFC completeness.
 *
 * Catches common user mistakes (whitespace, consecutive dots, short TLDs,
 * missing parts). Backend Pydantic EmailStr (powered by email_validator)
 * is the authoritative validation boundary. Full RFC validation (IP literal
 * domains, quoted local parts, IDN, SMTPUTF8, DNS validation) is delegated
 * intentionally.
 */
export function validateEmailFormat(email: string): EmailValidationResult {
  const trimmed = email.trim()

  if (!trimmed) {
    return { valid: false, message: 'Email address is invalid' }
  }

  const atCount = (trimmed.match(/@/g) || []).length
  if (atCount !== 1) {
    return { valid: false, message: 'Email address is invalid' }
  }

  const [local, domain] = trimmed.split('@')

  if (!local || !domain) {
    return { valid: false, message: 'Email address is invalid' }
  }

  if (/\s/.test(trimmed)) {
    return { valid: false, message: 'Email address is invalid' }
  }

  if (local.startsWith('.') || local.endsWith('.')) {
    return { valid: false, message: 'Email address is invalid' }
  }

  if (local.includes('..')) {
    return { valid: false, message: 'Email address is invalid' }
  }

  if (domain.startsWith('.') || domain.endsWith('.')) {
    return { valid: false, message: 'Email address is invalid' }
  }

  if (domain.includes('..')) {
    return { valid: false, message: 'Email address is invalid' }
  }

  if (!domain.includes('.')) {
    return { valid: false, message: 'Email address is invalid' }
  }

  const labels = domain.split('.')
  const tld = labels[labels.length - 1]
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return { valid: false, message: 'Email address is invalid' }
  }

  return { valid: true, message: null }
}
