import type { DateFilterPreset } from './dateFilterUtils'

const DEFAULT_LOCALE = 'en-US'

const presetLabels: Record<string, Record<DateFilterPreset, string>> = {
  'en-US': {
    today: 'Today',
    last_3_days: 'Last 3 Days',
    last_week: 'Last Week',
    last_2_weeks: 'Last 2 Weeks',
    last_month: 'Last Month',
    last_3_months: 'Last 3 Months',
    this_year: 'This Year',
    last_year: 'Past Year',
  },
  fr: {
    today: "Aujourd'hui",
    last_3_days: '3 Derniers Jours',
    last_week: 'Semaine Dernière',
    last_2_weeks: '2 Dernières Semaines',
    last_month: 'Mois Dernier',
    last_3_months: '3 Derniers Mois',
    this_year: 'Cette Année',
    last_year: 'Année Passée',
  },
  es: {
    today: 'Hoy',
    last_3_days: 'Últimos 3 Días',
    last_week: 'Semana Pasada',
    last_2_weeks: 'Últimas 2 Semanas',
    last_month: 'Mes Pasado',
    last_3_months: 'Últimos 3 Meses',
    this_year: 'Este Año',
    last_year: 'Año Pasado',
  },
  de: {
    today: 'Heute',
    last_3_days: 'Letzte 3 Tage',
    last_week: 'Letzte Woche',
    last_2_weeks: 'Letzte 2 Wochen',
    last_month: 'Letzter Monat',
    last_3_months: 'Letzte 3 Monate',
    this_year: 'Dieses Jahr',
    last_year: 'Vergangenes Jahr',
  },
  pt: {
    today: 'Hoje',
    last_3_days: 'Últimos 3 Dias',
    last_week: 'Semana Passada',
    last_2_weeks: 'Últimas 2 Semanas',
    last_month: 'Mês Passado',
    last_3_months: 'Últimos 3 Meses',
    this_year: 'Este Ano',
    last_year: 'Ano Passado',
  },
  ja: {
    today: '今日',
    last_3_days: '過去3日間',
    last_week: '先週',
    last_2_weeks: '過去2週間',
    last_month: '先月',
    last_3_months: '過去3ヶ月',
    this_year: '今年',
    last_year: '過去1年',
  },
  zh: {
    today: '今天',
    last_3_days: '过去3天',
    last_week: '上周',
    last_2_weeks: '过去2周',
    last_month: '上个月',
    last_3_months: '过去3个月',
    this_year: '今年',
    last_year: '过去一年',
  },
  ko: {
    today: '오늘',
    last_3_days: '지난 3일',
    last_week: '지난 주',
    last_2_weeks: '지난 2주',
    last_month: '지난 달',
    last_3_months: '지난 3개월',
    this_year: '올해',
    last_year: '지난 1년',
  },
}

function normalizeLocale(locale: string): string {
  const base = locale.split('-')[0].toLowerCase()
  if (presetLabels[base]) return base
  return DEFAULT_LOCALE
}

export function getPresetLabel(preset: DateFilterPreset, locale: string): string {
  const lang = normalizeLocale(locale)
  return presetLabels[lang]?.[preset] ?? presetLabels[DEFAULT_LOCALE][preset]
}

const validationMessages: Record<string, Record<string, string>> = {
  'en-US': {
    start_after_end: 'Start date must be before end date',
    below_min_date: 'Date must be on or after {minDate}',
    future_date: 'End date must not be in the future',
  },
  fr: {
    start_after_end: 'La date de début doit être antérieure à la date de fin',
    below_min_date: 'La date doit être le {minDate} ou après',
    future_date: "La date de fin ne doit pas être dans le futur",
  },
  es: {
    start_after_end: 'La fecha de inicio debe ser anterior a la fecha de fin',
    below_min_date: 'La fecha debe ser el {minDate} o posterior',
    future_date: 'La fecha de fin no debe estar en el futuro',
  },
  de: {
    start_after_end: 'Das Startdatum muss vor dem Enddatum liegen',
    below_min_date: 'Datum muss am oder nach dem {minDate} sein',
    future_date: 'Das Enddatum darf nicht in der Zukunft liegen',
  },
  pt: {
    start_after_end: 'A data de início deve ser anterior à data de fim',
    below_min_date: 'A data deve ser em ou após {minDate}',
    future_date: 'A data de fim não deve estar no futuro',
  },
  ja: {
    start_after_end: '開始日は終了日より前である必要があります',
    below_min_date: '日付は{minDate}以降である必要があります',
    future_date: '終了日は未来であってはなりません',
  },
  zh: {
    start_after_end: '开始日期必须早于结束日期',
    below_min_date: '日期必须在{minDate}或之后',
    future_date: '结束日期不能在将来',
  },
  ko: {
    start_after_end: '시작일은 종료일보다 이전이어야 합니다',
    below_min_date: '날짜는 {minDate} 이후여야 합니다',
    future_date: '종료일은 미래일 수 없습니다',
  },
}

export function getValidationMessage(
  key: 'start_after_end' | 'below_min_date' | 'future_date',
  locale: string,
  params?: { minDate?: string }
): string {
  const lang = normalizeLocale(locale)
  const msg = validationMessages[lang]?.[key] ?? validationMessages[DEFAULT_LOCALE][key]
  if (params?.minDate) {
    return msg.replace('{minDate}', params.minDate)
  }
  return msg
}

export function formatISODateNumeric(iso: string, locale: string): string {
  return isoToLocaleString(iso, locale)
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const parts = iso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (m < 1 || m > 12 || d < 1 || y < 1000) return false;
  const daysInMonth = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[m - 1];
}

export function parseDateInputToISO(input: string, localeOrder: 'MDY' | 'DMY' | 'YMD'): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  if (/^\d{8}$/.test(trimmed)) {
    if (localeOrder === 'MDY') return `${trimmed.slice(4, 8)}-${trimmed.slice(0, 2)}-${trimmed.slice(2, 4)}`;
    if (localeOrder === 'DMY') return `${trimmed.slice(4, 8)}-${trimmed.slice(2, 4)}-${trimmed.slice(0, 2)}`;
    if (localeOrder === 'YMD') return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  const parts = trimmed.split(/[./-]/);
  if (parts.length === 3) {
    const p1 = parts[0].padStart(2, '0');
    const p2 = parts[1].padStart(2, '0');
    const p3 = parts[2];

    if (p3.length === 4) {
      if (localeOrder === 'MDY') return `${p3}-${p1}-${p2}`;
      if (localeOrder === 'DMY') return `${p3}-${p2}-${p1}`;
    } else if (p1.length === 4) {
      if (localeOrder === 'YMD') return `${p1}-${p2}-${p3.padStart(2, '0')}`;
    }
  }

  return '';
}

export function isoToLocaleString(iso: string, locale: string): string {
  if (!isValidISODate(iso)) return '';
  const parts = iso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const date = new Date(Date.UTC(y, m - 1, d));
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return iso;
  }
}

export function getLocaleOrder(locale: string): 'MDY' | 'DMY' | 'YMD' {
  try {
    const format = new Intl.DateTimeFormat(locale).formatToParts(new Date(Date.UTC(2026, 11, 31)));
    const parts = format.filter(p => p.type === 'year' || p.type === 'month' || p.type === 'day');
    if (parts.length === 3) {
      if (parts[0].type === 'month' && parts[1].type === 'day') return 'MDY';
      if (parts[0].type === 'day' && parts[1].type === 'month') return 'DMY';
    }
    return 'YMD';
  } catch {
    return 'YMD';
  }
}

export function getLocalePlaceholder(locale: string): string {
  const order = getLocaleOrder(locale);
  if (order === 'MDY') return 'MM/DD/YYYY';
  if (order === 'DMY') return 'DD/MM/YYYY';
  return 'YYYY/MM/DD';
}
