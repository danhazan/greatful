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

export function formatDateForLocale(dateStr: string, locale: string): string {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  try {
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}
