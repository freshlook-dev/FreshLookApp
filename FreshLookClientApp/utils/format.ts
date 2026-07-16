const KOSOVO_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Belgrade',
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const KOSOVO_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Belgrade',
  calendar: 'gregory',
  numberingSystem: 'latn',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatLocalDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseLocalDateOnly(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year &&
    result.getMonth() + 1 === month &&
    result.getDate() === day
    ? result
    : null;
}

export function formatKosovoDateOnly(value: Date = new Date()) {
  const parts = KOSOVO_DATE_FORMATTER.formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const result = `${get('year')}-${get('month')}-${get('day')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(result)
    ? result
    : formatLocalDateOnly(value);
}

function formatNumericDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Pa datë';
  const date = parseLocalDateOnly(value);
  if (!date) return value;
  return formatNumericDate(date);
}

export function formatTime(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 5);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Pa datë';
  const normalized = value.trim().replace(' ', 'T');
  const date = new Date(
    /(?:z|[+-]\d{2}:?\d{2})$/i.test(normalized)
      ? normalized
      : `${normalized}Z`
  );
  if (Number.isNaN(date.getTime())) return value;
  const parts = KOSOVO_DATE_TIME_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}, ${get('hour')}:${get('minute')}`;
}
