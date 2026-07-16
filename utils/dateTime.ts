export const KOSOVO_TIME_ZONE = 'Europe/Belgrade';

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const zonedFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KOSOVO_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const partsInKosovo = (timestamp: number): DateTimeParts | null => {
  const values = new Map(
    zonedFormatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  const result = {
    year: values.get('year') ?? Number.NaN,
    month: values.get('month') ?? Number.NaN,
    day: values.get('day') ?? Number.NaN,
    hour: values.get('hour') ?? Number.NaN,
    minute: values.get('minute') ?? Number.NaN,
    second: values.get('second') ?? Number.NaN,
  };

  return Object.values(result).every(Number.isFinite) ? result : null;
};

const sameParts = (left: DateTimeParts, right: DateTimeParts) =>
  left.year === right.year &&
  left.month === right.month &&
  left.day === right.day &&
  left.hour === right.hour &&
  left.minute === right.minute &&
  left.second === right.second;

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Serialize a calendar date selected in the device UI without UTC shifting. */
export const formatLocalDateOnly = (value: Date) =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

/** Parse YYYY-MM-DD as local calendar components rather than as UTC. */
export const parseLocalDateOnly = (
  value: string | null | undefined
): Date | null => {
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
};

/** Current/instant date in the Kosovo salon timezone. */
export const formatKosovoDateOnly = (value: Date = new Date()) => {
  const parts = partsInKosovo(value.getTime());
  return parts
    ? `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
    : formatLocalDateOnly(value);
};

/** Kosovo's current date represented as a local Date for native date pickers. */
export const kosovoDateForPicker = (value: Date = new Date()) =>
  parseLocalDateOnly(formatKosovoDateOnly(value)) ?? value;

export const kosovoMinutesSinceMidnight = (value: Date = new Date()) => {
  const parts = partsInKosovo(value.getTime());
  return parts
    ? parts.hour * 60 + parts.minute + parts.second / 60
    : value.getHours() * 60 + value.getMinutes() + value.getSeconds() / 60;
};

/** Whether a salon slot is at least the requested number of minutes away. */
export const isKosovoSlotAtLeastMinutesAway = (
  dateValue: string | null | undefined,
  timeValue: string | null | undefined,
  minimumLeadMinutes: number,
  now: Date = new Date()
) => {
  const today = formatKosovoDateOnly(now);
  if (!dateValue || dateValue < today) return false;
  if (dateValue > today) return true;

  const match = timeValue?.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59 || minimumLeadMinutes < 0) return false;

  return hours * 60 + minutes >=
    kosovoMinutesSinceMidnight(now) + minimumLeadMinutes;
};

/** Convert a Kosovo salon wall-clock value into an absolute instant. */
export const kosovoAppointmentDateTime = (
  dateValue: string | null | undefined,
  timeValue: string | null | undefined
) => {
  const dateMatch = dateValue?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeValue?.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!dateMatch || !timeMatch) return null;

  const expected: DateTimeParts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? 0),
  };
  const utcGuess = Date.UTC(
    expected.year,
    expected.month - 1,
    expected.day,
    expected.hour,
    expected.minute,
    expected.second
  );
  const normalizedGuess = new Date(utcGuess);

  // Date.UTC normalizes invalid values (for example 31 February), so reject
  // them before calculating the timezone offset.
  if (
    normalizedGuess.getUTCFullYear() !== expected.year ||
    normalizedGuess.getUTCMonth() + 1 !== expected.month ||
    normalizedGuess.getUTCDate() !== expected.day ||
    normalizedGuess.getUTCHours() !== expected.hour ||
    normalizedGuess.getUTCMinutes() !== expected.minute ||
    normalizedGuess.getUTCSeconds() !== expected.second
  ) {
    return null;
  }

  let timestamp = utcGuess;
  // Two passes handle the offset change when the initial UTC guess falls on
  // the other side of a daylight-saving transition.
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = partsInKosovo(timestamp);
    if (!actual) return null;
    const representedAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    timestamp -= representedAsUtc - utcGuess;
  }

  const finalParts = partsInKosovo(timestamp);
  return finalParts && sameParts(finalParts, expected) ? new Date(timestamp) : null;
};

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

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KOSOVO_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}, ${get('hour')}:${get('minute')}`;
};
