import { resolveLocale } from '../locale'

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

  it('returns runtime default locale when navigator is undefined (SSR)', () => {
    const { navigator } = globalThis
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
    })
    const result = resolveLocale()
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
    Object.defineProperty(globalThis, 'navigator', {
      value: navigator,
      configurable: true,
    })
  })

  it('returns fr-FR when it is the only preferred language', () => {
    setNavigator(['fr-FR'])
    expect(resolveLocale()).toBe('fr-FR')
  })

  it('returns fr-FR over en-US when French is preferred (European user)', () => {
    setNavigator(['en-US', 'fr-FR'])
    expect(resolveLocale()).toBe('fr-FR')
  })

  it('returns de-DE over en-US when German is preferred', () => {
    setNavigator(['en-US', 'de-DE'])
    expect(resolveLocale()).toBe('de-DE')
  })

  it('returns en-GB over en-US when British English is preferred (DMY)', () => {
    setNavigator(['en-US', 'en-GB'])
    expect(resolveLocale()).toBe('en-GB')
  })

  it('returns en-US when only US English is available (genuine US user)', () => {
    setNavigator(['en-US'])
    expect(resolveLocale()).toBe('en-US')
  })

  it('returns en when only unqualified English is available', () => {
    setNavigator(['en'])
    expect(resolveLocale()).toBe('en')
  })

  it('returns en-AU over en-US when Australian English is preferred', () => {
    setNavigator(['en-US', 'en-AU'])
    expect(resolveLocale()).toBe('en-AU')
  })

  it('returns it-IT over en when Italian is in the list', () => {
    setNavigator(['en', 'it-IT'])
    expect(resolveLocale()).toBe('it-IT')
  })

  it('skips DMY-detection when English has no region and no European language present', () => {
    setNavigator(['en', 'en-US'])
    const result = resolveLocale()
    expect(result).toBe('en')
  })

  it('handles empty languages array', () => {
    setNavigator([], 'en-US')
    expect(resolveLocale()).toBe('en-US')
  })

  it('handles complex navigator.languages ordering', () => {
    setNavigator(['en-US', 'en', 'en-GB', 'fr-FR'])
    expect(resolveLocale()).toBe('fr-FR')
  })

  it('returns en-IE (DD/MM/YYYY) as an English non-US option when available', () => {
    setNavigator(['en-US', 'en-IE'])
    expect(resolveLocale()).toBe('en-IE')
  })

  it('detects pt-BR (DD/MM/YYYY) as a non-English locale', () => {
    setNavigator(['en-US', 'pt-BR'])
    expect(resolveLocale()).toBe('pt-BR')
  })

  it('detects ja-JP (YYYY/MM/DD) as a non-English locale', () => {
    setNavigator(['en-US', 'ja-JP'])
    expect(resolveLocale()).toBe('ja-JP')
  })
})
