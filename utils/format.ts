import { formatKosovoDateTime, parseLocalDateOnly } from './dateTime';

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
  const formatted = formatKosovoDateTime(value);
  return formatted === '-' ? value : formatted;
}
