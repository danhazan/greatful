import { validateEmailFormat, normalizeEmail } from '../emailValidation'

describe('validateEmailFormat', () => {
  describe('valid addresses', () => {
    const valid = [
      'user@example.com',
      'john.smith@example.co.uk',
      'user+tag@example.org',
      'first_last@example.io',
      '123@example.net',
      'a@b.co',
      'test+filter@example.com',
    ]
    valid.forEach(email => {
      it(`accepts "${email}"`, () => {
        const result = validateEmailFormat(email)
        expect(result.valid).toBe(true)
        expect(result.message).toBeNull()
      })
    })
  })

  describe('empty and missing parts', () => {
    it('rejects empty string', () => {
      const result = validateEmailFormat('')
      expect(result.valid).toBe(false)
    })

    it('rejects only @', () => {
      const result = validateEmailFormat('@')
      expect(result.valid).toBe(false)
    })

    it('rejects missing domain after @', () => {
      const result = validateEmailFormat('test@')
      expect(result.valid).toBe(false)
    })

    it('rejects missing local part', () => {
      const result = validateEmailFormat('@example.com')
      expect(result.valid).toBe(false)
    })

    it('rejects dotless domain', () => {
      const result = validateEmailFormat('test@example')
      expect(result.valid).toBe(false)
    })

    it('rejects a@.', () => {
      const result = validateEmailFormat('a@.')
      expect(result.valid).toBe(false)
    })
  })

  describe('multiple @', () => {
    it('rejects two @', () => {
      const result = validateEmailFormat('user@@example.com')
      expect(result.valid).toBe(false)
    })
  })

  describe('whitespace', () => {
    it('rejects space in local', () => {
      const result = validateEmailFormat('user name@example.com')
      expect(result.valid).toBe(false)
    })

    it('rejects space in domain', () => {
      const result = validateEmailFormat('user@ex ample.com')
      expect(result.valid).toBe(false)
    })

    it('trims surrounding whitespace before validating', () => {
      const result = validateEmailFormat('  test@example.com  ')
      expect(result.valid).toBe(true)
    })

    it('rejects leading whitespace-only local after trim', () => {
      const result = validateEmailFormat('  ')
      expect(result.valid).toBe(false)
    })
  })

  describe('consecutive dots', () => {
    it('rejects consecutive dots in local', () => {
      const result = validateEmailFormat('john..smith@example.com')
      expect(result.valid).toBe(false)
    })

    it('rejects consecutive dots in domain', () => {
      const result = validateEmailFormat('user@example..com')
      expect(result.valid).toBe(false)
    })
  })

  describe('leading and trailing dots', () => {
    it('rejects leading dot in local', () => {
      const result = validateEmailFormat('.user@example.com')
      expect(result.valid).toBe(false)
    })

    it('rejects trailing dot in local', () => {
      const result = validateEmailFormat('user.@example.com')
      expect(result.valid).toBe(false)
    })

    it('rejects leading dot in domain', () => {
      const result = validateEmailFormat('user@.example.com')
      expect(result.valid).toBe(false)
    })

    it('rejects trailing dot in domain', () => {
      const result = validateEmailFormat('user@example.com.')
      expect(result.valid).toBe(false)
    })
  })

  describe('short TLD', () => {
    it('rejects single-character TLD', () => {
      const result = validateEmailFormat('user@example.c')
      expect(result.valid).toBe(false)
    })

    it('rejects numeric TLD', () => {
      const result = validateEmailFormat('user@example.123')
      expect(result.valid).toBe(false)
    })

    it('accepts two-character TLD', () => {
      const result = validateEmailFormat('user@example.co')
      expect(result.valid).toBe(true)
    })
  })

  describe('empty domain labels', () => {
    it('rejects dot at start of domain', () => {
      const result = validateEmailFormat('a@.com')
      expect(result.valid).toBe(false)
    })

    it('rejects dot at end of domain', () => {
      const result = validateEmailFormat('a@com.')
      expect(result.valid).toBe(false)
    })

    it('rejects consecutive dots in domain', () => {
      const result = validateEmailFormat('a@..com')
      expect(result.valid).toBe(false)
    })
  })

  describe('normalizeEmail', () => {
    it('trims leading whitespace', () => {
      expect(normalizeEmail('  user@example.com')).toBe('user@example.com')
    })

    it('trims trailing whitespace', () => {
      expect(normalizeEmail('user@example.com  ')).toBe('user@example.com')
    })

    it('trims both sides', () => {
      expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com')
    })

    it('leaves already-normalized email unchanged', () => {
      expect(normalizeEmail('user@example.com')).toBe('user@example.com')
    })

    it('does not lowercase', () => {
      expect(normalizeEmail('User@Example.COM')).toBe('User@Example.COM')
    })

    it('handles empty string', () => {
      expect(normalizeEmail('')).toBe('')
    })

    it('handles whitespace-only string', () => {
      expect(normalizeEmail('   ')).toBe('')
    })
  })

  describe('trimming', () => {
    it('accepts email with leading whitespace', () => {
      const result = validateEmailFormat('  user@example.com')
      expect(result.valid).toBe(true)
    })

    it('accepts email with trailing whitespace', () => {
      const result = validateEmailFormat('user@example.com  ')
      expect(result.valid).toBe(true)
    })

    it('rejects whitespace-only', () => {
      const result = validateEmailFormat('   ')
      expect(result.valid).toBe(false)
    })
  })
})
