const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timeZone: string) {
  let formatter = dateTimeFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    dateTimeFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function timeZoneOffsetMs(instant: Date, timeZone: string) {
  const values: Record<string, number> = {};
  for (const part of getPartsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }

  const representedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );
  return representedAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function parseLocalDateTime(date: string, time: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match || !timeMatch) throw new Error('INVALID_LOCAL_DATE_TIME');

  const [, year, month, day] = match;
  const [, hour, minute, second = '00'] = timeMatch;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

export function localDateTimeToIso(date: string, time: string, timeZone: string) {
  const wallClockUtc = parseLocalDateTime(date, time);
  const initial = new Date(wallClockUtc);
  let result = wallClockUtc - timeZoneOffsetMs(initial, timeZone);

  const correctedOffset = timeZoneOffsetMs(new Date(result), timeZone);
  result = wallClockUtc - correctedOffset;
  return new Date(result).toISOString();
}

export function localDayUtcRange(date: string, timeZone: string) {
  const localMidnight = parseLocalDateTime(date, '00:00');
  const nextDate = new Date(localMidnight + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    start: localDateTimeToIso(date, '00:00', timeZone),
    endExclusive: localDateTimeToIso(nextDate, '00:00', timeZone),
  };
}

export function formatTimeInZone(isoString: string, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(isoString));
}

export function dateInZone(instant: Date, timeZone: string) {
  const values: Record<string, string> = {};
  for (const part of getPartsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftCalendarDate(date: string, days: number) {
  const midnightUtc = parseLocalDateTime(date, '00:00');
  return new Date(midnightUtc + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function formatLeadTime(minutes?: number): string {
  if (!minutes || minutes <= 0) return 'o horário agendado';
  if (minutes < 60) return `${minutes} minutos antes`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return hours === 1 ? '1 hora antes' : `${hours} horas antes`;
  }
  return `${hours}h ${remainingMinutes}min antes`;
}

export function isSlotViableForToday(
  slot: string,
  currentLocalTime: string,
  leadTimeMinutes: number = 15,
): boolean {
  const [slotH, slotM] = slot.split(':').map(Number);
  const slotTotal = slotH * 60 + slotM;

  const [currH, currM] = currentLocalTime.split(':').map(Number);
  const minViableTotal = currH * 60 + currM + leadTimeMinutes;

  return slotTotal >= minViableTotal;
}
