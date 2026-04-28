const KOSOVO_TIME_ZONE = 'Europe/Belgrade';

const hasExplicitTimeZone = (value: string) =>
  /(?:z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

const parseSupabaseDate = (value: string) => {
  const normalized = value.trim().replace(' ', 'T');
  return new Date(hasExplicitTimeZone(normalized) ? normalized : `${normalized}Z`);
};

export const formatKosovoDateTime = (value: string | null | undefined) => {
  if (!value) return '-';

  const date = parseSupabaseDate(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KOSOVO_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};
