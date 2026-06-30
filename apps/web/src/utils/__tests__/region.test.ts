import { describe, it, expect } from '@jest/globals'
import { countryCodeToLocale } from '../region'

describe('countryCodeToLocale', () => {
  it('maps US to en-US', () => {
    expect(countryCodeToLocale('US')).toBe('en-US')
  })

  it('maps GB to en-GB', () => {
    expect(countryCodeToLocale('GB')).toBe('en-GB')
  })

  it('maps FR to fr-FR', () => {
    expect(countryCodeToLocale('FR')).toBe('fr-FR')
  })

  it('maps DE to de-DE', () => {
    expect(countryCodeToLocale('DE')).toBe('de-DE')
  })

  it('maps SE to sv-SE', () => {
    expect(countryCodeToLocale('SE')).toBe('sv-SE')
  })

  it('maps JP to ja-JP', () => {
    expect(countryCodeToLocale('JP')).toBe('ja-JP')
  })

  it('returns null for unmapped country code', () => {
    expect(countryCodeToLocale('XX')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(countryCodeToLocale(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(countryCodeToLocale(undefined)).toBeNull()
  })

  it('handles lowercase input', () => {
    expect(countryCodeToLocale('us')).toBe('en-US')
  })

  it('handles mixed case input', () => {
    expect(countryCodeToLocale('Gb')).toBe('en-GB')
  })

  it('returns null for empty string', () => {
    expect(countryCodeToLocale('')).toBeNull()
  })
})
