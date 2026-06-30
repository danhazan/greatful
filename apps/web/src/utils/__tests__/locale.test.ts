import { describe, it, expect, jest } from '@jest/globals'
import { resolveLocale, resolveLocaleFromBrowser, resolveLocaleFromCountry } from '../locale'

function setNavigator(languages: string[], language?: string) {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      languages: languages,
      language: language || languages[0] || 'en-US',
    },
    configurable: true,
    writable: true,
  })
}

describe('resolveLocale', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns runtime default locale', () => {
    const result = resolveLocale()
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })
})

describe('resolveLocaleFromBrowser', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns runtime default locale when navigator is undefined (SSR)', () => {
    const { navigator } = globalThis
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
    })
    const result = resolveLocaleFromBrowser()
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
    Object.defineProperty(globalThis, 'navigator', {
      value: navigator,
      configurable: true,
    })
  })

  it('returns fr-FR when it is the only preferred language', () => {
    setNavigator(['fr-FR'])
    expect(resolveLocaleFromBrowser()).toBe('fr-FR')
  })

  it('returns fr-FR over en-US when French is preferred (European user)', () => {
    setNavigator(['en-US', 'fr-FR'])
    expect(resolveLocaleFromBrowser()).toBe('fr-FR')
  })

  it('returns de-DE over en-US when German is preferred', () => {
    setNavigator(['en-US', 'de-DE'])
    expect(resolveLocaleFromBrowser()).toBe('de-DE')
  })

  it('returns en-GB over en-US when British English is preferred (DMY)', () => {
    setNavigator(['en-US', 'en-GB'])
    expect(resolveLocaleFromBrowser()).toBe('en-GB')
  })

  it('returns en-US when only US English is available (genuine US user)', () => {
    setNavigator(['en-US'])
    expect(resolveLocaleFromBrowser()).toBe('en-US')
  })

  it('returns en when only unqualified English is available', () => {
    setNavigator(['en'])
    expect(resolveLocaleFromBrowser()).toBe('en')
  })

  it('returns en-AU over en-US when Australian English is preferred', () => {
    setNavigator(['en-US', 'en-AU'])
    expect(resolveLocaleFromBrowser()).toBe('en-AU')
  })

  it('returns it-IT over en when Italian is in the list', () => {
    setNavigator(['en', 'it-IT'])
    expect(resolveLocaleFromBrowser()).toBe('it-IT')
  })

  it('skips DMY-detection when English has no region and no European language present', () => {
    setNavigator(['en', 'en-US'])
    const result = resolveLocaleFromBrowser()
    expect(result).toBe('en')
  })

  it('handles empty languages array', () => {
    setNavigator([], 'en-US')
    expect(resolveLocaleFromBrowser()).toBe('en-US')
  })

  it('handles complex navigator.languages ordering', () => {
    setNavigator(['en-US', 'en', 'en-GB', 'fr-FR'])
    expect(resolveLocaleFromBrowser()).toBe('fr-FR')
  })

  it('returns en-IE (DD/MM/YYYY) as an English non-US option when available', () => {
    setNavigator(['en-US', 'en-IE'])
    expect(resolveLocaleFromBrowser()).toBe('en-IE')
  })

  it('detects pt-BR (DD/MM/YYYY) as a non-English locale', () => {
    setNavigator(['en-US', 'pt-BR'])
    expect(resolveLocaleFromBrowser()).toBe('pt-BR')
  })

  it('detects ja-JP (YYYY/MM/DD) as a non-English locale', () => {
    setNavigator(['en-US', 'ja-JP'])
    expect(resolveLocaleFromBrowser()).toBe('ja-JP')
  })
})

describe('resolveLocaleFromCountry', () => {
  it('returns en-US for US country code', () => {
    expect(resolveLocaleFromCountry('US')).toBe('en-US')
  })

  it('returns en-GB for GB country code', () => {
    expect(resolveLocaleFromCountry('GB')).toBe('en-GB')
  })

  it('returns fr-FR for FR country code', () => {
    expect(resolveLocaleFromCountry('FR')).toBe('fr-FR')
  })

  it('returns sv-SE for SE country code', () => {
    expect(resolveLocaleFromCountry('SE')).toBe('sv-SE')
  })

  it('returns null-equivalent (runtime fallback) for unmapped country', () => {
    const result = resolveLocaleFromCountry('XX')
    const runtime = resolveLocale()
    expect(result).toBe(runtime)
  })

  it('returns runtime fallback for null country', () => {
    const result = resolveLocaleFromCountry(null)
    const runtime = resolveLocale()
    expect(result).toBe(runtime)
  })

  it('returns runtime fallback for undefined country', () => {
    const result = resolveLocaleFromCountry(undefined)
    const runtime = resolveLocale()
    expect(result).toBe(runtime)
  })

  it('handles lowercase country code', () => {
    expect(resolveLocaleFromCountry('gb')).toBe('en-GB')
  })
})
