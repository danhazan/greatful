import { isValidISODate, parseDateInputToISO, isoToLocaleString, getLocaleOrder } from '../dateFilterLocale';
import { describe, it, expect } from '@jest/globals';

describe('dateFilterLocale utils', () => {
  describe('isValidISODate', () => {
    it('validates correct ISO dates', () => {
      expect(isValidISODate('2026-01-01')).toBe(true);
      expect(isValidISODate('2026-12-31')).toBe(true);
      expect(isValidISODate('2024-02-29')).toBe(true); // Leap year
    });

    it('rejects invalid dates', () => {
      expect(isValidISODate('2026-02-30')).toBe(false);
      expect(isValidISODate('2026-13-01')).toBe(false);
      expect(isValidISODate('2026-00-15')).toBe(false);
      expect(isValidISODate('2025-02-29')).toBe(false); // Not leap year
    });

    it('rejects partial or malformed strings', () => {
      expect(isValidISODate('2026-01')).toBe(false);
      expect(isValidISODate('01/01/2026')).toBe(false);
      expect(isValidISODate('2026-1-1')).toBe(false);
      expect(isValidISODate('2026-01-01T00:00:00Z')).toBe(false);
    });
  });

  describe('parseDateInputToISO', () => {
    it('accepts valid ISO paste directly', () => {
      expect(parseDateInputToISO('2026-01-01', 'MDY')).toBe('2026-01-01');
    });

    it('parses 8 digits based on localeOrder', () => {
      expect(parseDateInputToISO('12312026', 'MDY')).toBe('2026-12-31');
      expect(parseDateInputToISO('31122026', 'DMY')).toBe('2026-12-31');
      expect(parseDateInputToISO('20261231', 'YMD')).toBe('2026-12-31');
    });

    it('parses exactly 3 parts with explicit separators based on localeOrder', () => {
      // MDY
      expect(parseDateInputToISO('12/31/2026', 'MDY')).toBe('2026-12-31');
      expect(parseDateInputToISO('1/2/2026', 'MDY')).toBe('2026-01-02');
      // DMY
      expect(parseDateInputToISO('31.12.2026', 'DMY')).toBe('2026-12-31');
      expect(parseDateInputToISO('2-1-2026', 'DMY')).toBe('2026-01-02');
      // YMD
      expect(parseDateInputToISO('2026/12/31', 'YMD')).toBe('2026-12-31');
    });

    it('returns empty string for ambiguous or unparseable input', () => {
      expect(parseDateInputToISO('12/31', 'MDY')).toBe('');
      expect(parseDateInputToISO('2026', 'MDY')).toBe('');
      expect(parseDateInputToISO('abcdef', 'MDY')).toBe('');
    });
  });

  describe('isoToLocaleString', () => {
    it('formats valid ISO date according to locale', () => {
      expect(isoToLocaleString('2026-12-31', 'en-US')).toMatch(/12\/\d{2}\/2026/); // Format depends on Node Intl implementation, usually 12/31/2026
      expect(isoToLocaleString('2026-12-31', 'de-DE')).toMatch(/31\.12\.2026/);
    });

    it('returns empty string for invalid ISO dates', () => {
      expect(isoToLocaleString('2026-02-30', 'en-US')).toBe('');
      expect(isoToLocaleString('invalid', 'en-US')).toBe('');
    });
  });

  describe('getLocaleOrder', () => {
    it('determines MDY for en-US', () => {
      expect(getLocaleOrder('en-US')).toBe('MDY');
    });

    it('determines DMY for en-GB or de-DE', () => {
      expect(getLocaleOrder('en-GB')).toBe('DMY');
      expect(getLocaleOrder('de-DE')).toBe('DMY');
    });
  });
});
