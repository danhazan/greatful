export function countryCodeToLocale(country: string | undefined | null): string | null {
  if (!country) return null
  const code = country.toUpperCase()
  return COUNTRY_TO_LOCALE[code] ?? null
}

const COUNTRY_TO_LOCALE: Record<string, string> = {
  US: 'en-US',
  GB: 'en-GB',
  IE: 'en-IE',
  AU: 'en-AU',
  NZ: 'en-NZ',
  CA: 'en-CA',
  FR: 'fr-FR',
  DE: 'de-DE',
  IT: 'it-IT',
  ES: 'es-ES',
  PT: 'pt-PT',
  NL: 'nl-NL',
  BE: 'nl-BE',
  CH: 'de-CH',
  AT: 'de-AT',
  SE: 'sv-SE',
  DK: 'da-DK',
  NO: 'nb-NO',
  FI: 'fi-FI',
  PL: 'pl-PL',
  CZ: 'cs-CZ',
  SK: 'sk-SK',
  HU: 'hu-HU',
  RO: 'ro-RO',
  JP: 'ja-JP',
  CN: 'zh-CN',
  KR: 'ko-KR',
  BR: 'pt-BR',
  MX: 'es-MX',
  AR: 'es-AR',
  IN: 'en-IN',
}
