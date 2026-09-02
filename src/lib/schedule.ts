import { localDateTimeToIso, shiftCalendarDate } from './timezone';

export interface ProfessionalDaySchedule {
  active?: boolean;
  start?: string;
  end?: string;
  break_start?: string;
  break_end?: string;
}

export interface BusinessHoursDay {
  active?: boolean;
  open?: string;
  close?: string;
  start?: string;
  end?: string;
}

export type BusinessHoursConfig = Record<string, BusinessHoursDay>;

export type WeeklySchedule = Record<string, ProfessionalDaySchedule>;

export interface ScheduleProfessional {
  id: string;
  name: string;
  is_active: boolean;
  weekly_schedule?: WeeklySchedule | null;
}

export interface ScheduleGridSegment {
  start: string;
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

export type FittingTimeMode = 'grid' | 'custom';

export interface FittingAppointmentIntervalInput {
  date: string;
  time: string;
  timeZone: string;
  durationMinutes: number;
  mode: FittingTimeMode;
  slotIntervalMinutes: number;
}

export interface FittingAppointmentInterval {
  startIso: string;
  endIso: string;
  startLocal: { date: string; time: string };
  endLocal: { date: string; time: string };
}

const ENGLISH_DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const PT_DAY_KEYS = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
];

const DEFAULT_BUSINESS_HOURS: Record<string, { active: boolean; open: string; close: string }> = {
  segunda: { active: true, open: '09:00', close: '18:00' },
  terca: { active: true, open: '09:00', close: '18:00' },
  quarta: { active: true, open: '09:00', close: '18:00' },
  quinta: { active: true, open: '09:00', close: '18:00' },
  sexta: { active: true, open: '09:00', close: '18:00' },
  sabado: { active: true, open: '09:00', close: '15:00' },
  domingo: { active: false, open: '09:00', close: '12:00' },
};

/** Normaliza configurações legadas em inglês ou português para as chaves do domínio. */
export const normalizeBusinessHours = (
  value: unknown
): Record<string, { active: boolean; open: string; close: string }> => {
  const source = value && typeof value === 'object'
    ? value as Record<string, BusinessHoursDay>
    : {};

  return PT_DAY_KEYS.reduce<Record<string, { active: boolean; open: string; close: string }>>((normalized, ptKey, index) => {
    const ptDay = source[ptKey] || {};
    const enDay = source[ENGLISH_DAY_KEYS[index]] || {};
    const fallback = DEFAULT_BUSINESS_HOURS[ptKey];

    normalized[ptKey] = {
      active: ptDay.active ?? enDay.active ?? fallback.active,
      open: ptDay.open || ptDay.start || enDay.open || enDay.start || fallback.open,
      close: ptDay.close || ptDay.end || enDay.close || enDay.end || fallback.close,
    };
    return normalized;
  }, {});
};

/**
 * Converte horário "HH:MM" em minutos totais desde as 00:00
 */
export const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Converte minutos totais em string "HH:MM"
 */
export const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const clampTimeToRange = (value: string, min: string, max: string): string => {
  const valueMinutes = timeToMinutes(value);
  const minMinutes = timeToMinutes(min);
  const maxMinutes = timeToMinutes(max);
  return minutesToTime(Math.min(maxMinutes, Math.max(minMinutes, valueMinutes)));
};

/**
 * Adiciona minutos a um horário no formato "HH:MM"
 */
export const addMinutesToTime = (timeStr: string, minutes: number): string => {
  return minutesToTime(timeToMinutes(timeStr) + minutes);
};

/**
 * Normaliza o intervalo configurado pelo tenant antes de gerar qualquer grade.
 * Valores ausentes ou inválidos usam o intervalo padrão da aplicação.
 */
export const normalizeSlotIntervalMinutes = (
  value: unknown,
  fallback = 30
): number => {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export interface ProfessionalServiceDurationOverride {
  service_id: string;
  custom_duration_minutes?: number | null;
  is_enabled?: boolean | null;
}

/** Resolve a duração usada nos conflitos e no término do atendimento. */
export const getEffectiveServiceDuration = (
  baseDurationMinutes: number,
  serviceId: string,
  professionalServices: ProfessionalServiceDurationOverride[] = []
): number => {
  const baseDuration = Number(baseDurationMinutes);
  const override = professionalServices.find((service) => service.service_id === serviceId);
  const customDuration = Number(override?.custom_duration_minutes);

  if (override?.is_enabled !== false && Number.isFinite(customDuration) && customDuration > 0) {
    return customDuration;
  }

  return Number.isFinite(baseDuration) && baseDuration > 0 ? baseDuration : 1;
};

/**
 * Verifica se o horário está alinhado à grade do tenant desde 00:00.
 * Fittings usam esta grade mesmo quando ficam fora do expediente oficial.
 */
export const isTimeAlignedToSlotInterval = (
  timeStr: string,
  slotIntervalMinutes: number
): boolean => {
  const interval = Number(slotIntervalMinutes);
  const minutes = timeToMinutes(timeStr);

  if (!Number.isFinite(interval) || interval <= 0) return false;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) return false;

  return minutes % interval === 0;
};

const isValidLocalDate = (dateStr: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === dateStr;
};

const isValidLocalTime = (timeStr: string): boolean =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr);

/**
 * Valida o horário inicial conforme a modalidade escolhida no formulário de encaixe.
 * O modo personalizado continua validando o relógio, mas não exige alinhamento à grade.
 */
export const isValidFittingStartTime = (
  timeStr: string,
  mode: FittingTimeMode,
  slotIntervalMinutes: number
): boolean => {
  if (!isValidLocalTime(timeStr)) return false;
  if (mode === 'custom') return true;
  return mode === 'grid' && isTimeAlignedToSlotInterval(timeStr, slotIntervalMinutes);
};

/**
 * Constrói o intervalo persistível de um encaixe no timezone do tenant.
 * O término é calculado pelo tempo efetivo do serviço e nunca é truncado pelo expediente.
 */
export const buildFittingAppointmentInterval = ({
  date,
  time,
  timeZone,
  durationMinutes,
  mode,
  slotIntervalMinutes,
}: FittingAppointmentIntervalInput): FittingAppointmentInterval => {
  if (!isValidLocalDate(date)) throw new Error('INVALID_LOCAL_DATE');
  if (!isValidFittingStartTime(time, mode, slotIntervalMinutes)) {
    throw new Error(mode === 'grid' ? 'FITTING_TIME_NOT_ALIGNED' : 'INVALID_LOCAL_TIME');
  }

  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('INVALID_SERVICE_DURATION');
  }

  const startMinutes = timeToMinutes(time);
  const endTotalMinutes = startMinutes + duration;
  const endDate = shiftCalendarDate(date, Math.floor(endTotalMinutes / (24 * 60)));
  const endTime = minutesToTime(endTotalMinutes % (24 * 60));

  return {
    startIso: localDateTimeToIso(date, time, timeZone),
    endIso: localDateTimeToIso(endDate, endTime, timeZone),
    startLocal: { date, time },
    endLocal: { date: endDate, time: endTime },
  };
};

/**
 * Gera todos os slots possíveis de um dia local para encaixes.
 * O intervalo é ancorado em 00:00 e o horário 24:00 não é um slot.
 */
export const generateFittingTimeSlots = (slotIntervalMinutes: number): string[] => {
  const step = Math.max(5, Number(slotIntervalMinutes) || 30);
  const slots: string[] = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
};

/**
 * Obtém o índice do dia da semana (0=Dom, 6=Sáb) a partir de uma data YYYY-MM-DD
 */
export const getDayOfWeekIndex = (dateStr: string): number => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.getDay();
};

/**
 * Recupera o expediente configurado de um profissional para determinada data
 */
export const getProfessionalDaySchedule = (
  prof: { weekly_schedule?: WeeklySchedule | null },
  dateStr: string
): ProfessionalDaySchedule | null => {
  if (!prof.weekly_schedule) return null;
  const dayIndex = getDayOfWeekIndex(dateStr);
  const enKey = ENGLISH_DAY_KEYS[dayIndex];
  const ptKey = PT_DAY_KEYS[dayIndex];
  return prof.weekly_schedule[enKey] || prof.weekly_schedule[ptKey] || null;
};

/**
 * Verifica se um horário de início ou serviço sobrepõe o intervalo do profissional.
 * Intervalo: [break_start, break_end)
 * Serviço: [timeSlot, timeSlot + durationMinutes)
 */
export const isProfessionalOnBreak = (
  prof: ScheduleProfessional,
  dateStr: string,
  timeSlot: string,
  durationMinutes: number = 0
): boolean => {
  const schedule = getProfessionalDaySchedule(prof, dateStr);
  if (!schedule || schedule.active === false) return false;
  if (!schedule.break_start || !schedule.break_end) return false;

  const breakStartMin = timeToMinutes(schedule.break_start);
  const breakEndMin = timeToMinutes(schedule.break_end);
  const slotStartMin = timeToMinutes(timeSlot);
  const effectiveDuration = durationMinutes > 0 ? durationMinutes : 1;
  const slotEndMin = slotStartMin + effectiveDuration;

  // Interseção entre [slotStartMin, slotEndMin) e [breakStartMin, breakEndMin)
  return slotStartMin < breakEndMin && slotEndMin > breakStartMin;
};

/**
 * Verifica se o profissional está trabalhando e disponível para realizar atendimento
 * em determinado dia, horário e duração de serviço.
 */
export const isProfessionalWorkingAt = (
  prof: ScheduleProfessional,
  dateStr: string,
  timeSlot: string,
  durationMinutes: number = 0,
  businessHours?: BusinessHoursConfig
): boolean => {
  if (!prof.is_active) return false;
  const dayBusinessHours = businessHours
    ? getDayBusinessHours(dateStr, businessHours)
    : null;
  const slotStartMin = timeToMinutes(timeSlot);

  if (
    dayBusinessHours &&
    (!dayBusinessHours.active ||
      slotStartMin < timeToMinutes(dayBusinessHours.open) ||
      slotStartMin >= timeToMinutes(dayBusinessHours.close))
  ) {
    return false;
  }

  const schedule = businessHours
    ? getEffectiveProfessionalDaySchedule(prof, dateStr, businessHours)
    : getProfessionalDaySchedule(prof, dateStr);
  if (!schedule) return true; // Sem escala explícita, considera disponível dentro do funcionamento geral
  if (schedule.active === false) return false;

  if (schedule.start && slotStartMin < timeToMinutes(schedule.start)) return false;
  // O fechamento limita o início do slot; a duração pode ultrapassar alguns minutos.
  if (schedule.end && slotStartMin >= timeToMinutes(schedule.end)) return false;

  if (isProfessionalOnBreak(prof, dateStr, timeSlot, durationMinutes)) return false;

  return true;
};

/**
 * Gera mensagem descritiva formatada com o intervalo do profissional
 */
export const getProfessionalBreakMessage = (
  prof: ScheduleProfessional,
  dateStr: string
): string => {
  const schedule = getProfessionalDaySchedule(prof, dateStr);
  const intervalStr =
    schedule?.break_start && schedule?.break_end
      ? `(${schedule.break_start} às ${schedule.break_end})`
      : 'de descanso';
  return `O profissional ${prof.name} está em horário de intervalo ${intervalStr}.`;
};

/**
 * Gera slots de horários considerando o expediente e reiniciando a grade
 * a partir do retorno do intervalo (break_end).
 *
 * Exemplo:
 * start = '08:00', end = '18:00', interval = 40m, break_start = '12:00', break_end = '13:00'
 * Manhã: 08:00, 08:40, 09:20, 10:00, 10:40, 11:20
 * Intervalo (12:00 às 13:00): omitido da agenda
 * Tarde (reinicia às 13:00): 13:00, 13:40, 14:20, 15:00, 15:40, 16:20, 17:00, 17:40
 */
export const generateTimeSlotsForSchedule = (
  start: string,
  end: string,
  stepMinutes: number,
  breakStart?: string,
  breakEnd?: string
): string[] => {
  const step = Math.max(5, stepMinutes || 30);
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const slots: string[] = [];

  const hasBreak = Boolean(
    breakStart &&
    breakEnd &&
    timeToMinutes(breakStart!) < timeToMinutes(breakEnd!) &&
    timeToMinutes(breakStart!) > startMin &&
    timeToMinutes(breakEnd!) < endMin
  );

  const bStartMin = hasBreak ? timeToMinutes(breakStart!) : endMin;
  const bEndMin = hasBreak ? timeToMinutes(breakEnd!) : endMin;

  // 1. Manhã / Antes do intervalo (do start até o breakStart)
  // Cada slot deve terminar estritamente antes ou no início do intervalo: m + step <= bStartMin
  for (let m = startMin; hasBreak ? m + step <= bStartMin : m < endMin; m += step) {
    slots.push(minutesToTime(m));
  }

  // 2. Tarde / Pós-intervalo: reinicia a grade estritamente no horário de retorno do intervalo (breakEnd)
  // O fechamento limita o início do slot; a duração do serviço é validada separadamente.
  if (hasBreak && bEndMin < endMin) {
    for (let m = bEndMin; m < endMin; m += step) {
      slots.push(minutesToTime(m));
    }
  }

  return slots;
};

/**
 * Gera a régua da agenda a partir dos segmentos do expediente usando um único
 * intervalo do tenant. A união evita que escalas sobrepostas dupliquem slots.
 */
export const generateScheduleGridSlots = (
  schedules: ScheduleGridSegment[],
  slotIntervalMinutes: unknown
): string[] => {
  const interval = normalizeSlotIntervalMinutes(slotIntervalMinutes);
  const slots = new Set<string>();

  schedules.forEach((schedule) => {
    generateTimeSlotsForSchedule(
      schedule.start,
      schedule.end,
      interval,
      schedule.breakStart,
      schedule.breakEnd
    ).forEach((slot) => slots.add(slot));
  });

  return Array.from(slots).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
};

/** Gera opções de escala incluindo o fechamento, sempre dentro do expediente. */
export const generateScheduleTimeOptions = (
  start: string,
  end: string,
  stepMinutes: number
): string[] => {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const step = Math.max(5, Number(stepMinutes) || 30);
  if (startMin > endMin) return [];

  const options: string[] = [];
  for (let minute = startMin; minute <= endMin; minute += step) {
    options.push(minutesToTime(minute));
  }
  if (options.at(-1) !== minutesToTime(endMin)) {
    options.push(minutesToTime(endMin));
  }
  return options;
};

/**
 * Gera opções para a escala do profissional sem confundir a precisão do
 * seletor com a cadência dos slots de agendamento do tenant.
 */
export const generateProfessionalTimeOptions = (
  start: string,
  end: string,
  precisionMinutes = 5
): string[] => generateScheduleTimeOptions(start, end, precisionMinutes);

/**
 * Obtém o horário de funcionamento da barbearia para determinada data
 */
export const getBusinessHoursForDayKey = (
  dayKey: string,
  businessHours?: BusinessHoursConfig
) => {
  const englishIndex = ENGLISH_DAY_KEYS.indexOf(dayKey);
  const portugueseIndex = PT_DAY_KEYS.indexOf(dayKey);
  const dayIndex = englishIndex >= 0 ? englishIndex : portugueseIndex >= 0 ? portugueseIndex : 1;
  const ptKey = PT_DAY_KEYS[dayIndex];
  const enKey = ENGLISH_DAY_KEYS[dayIndex];

  const ptDay = businessHours?.[ptKey];
  const enDay = businessHours?.[enKey];
  const fallback = DEFAULT_BUSINESS_HOURS[ptKey] || { active: true, open: '09:00', close: '18:00' };

  return {
    active: ptDay?.active ?? enDay?.active ?? fallback.active,
    open: ptDay?.open ?? ptDay?.start ?? enDay?.open ?? enDay?.start ?? fallback.open,
    close: ptDay?.close ?? ptDay?.end ?? enDay?.close ?? enDay?.end ?? fallback.close,
    dayLabel: ptKey,
  };
};

export const getDayBusinessHours = (
  dateStr: string,
  businessHours?: BusinessHoursConfig
) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return getBusinessHoursForDayKey(PT_DAY_KEYS[dateObj.getDay()], businessHours);
};

/**
 * Retorna a escala efetiva do profissional dentro dos limites da barbearia.
 * O banco aplica a mesma regra ao persistir alterações do estabelecimento;
 * este seam mantém as telas consistentes enquanto os dados estão em memória.
 */
export const clampProfessionalScheduleToBusinessHours = (
  schedule: ProfessionalDaySchedule | null | undefined,
  businessHours: BusinessHoursDay | null | undefined
): ProfessionalDaySchedule | null => {
  if (!schedule) return null;
  if (!businessHours) return { ...schedule };
  if (businessHours.active === false) return { ...schedule, active: false };

  const businessStart = timeToMinutes(businessHours.open || businessHours.start || '00:00');
  const businessEnd = timeToMinutes(businessHours.close || businessHours.end || '24:00');
  const effectiveStart = Math.max(
    timeToMinutes(schedule.start || businessHours.open || businessHours.start || '00:00'),
    businessStart
  );
  const effectiveEnd = Math.min(
    timeToMinutes(schedule.end || businessHours.close || businessHours.end || '24:00'),
    businessEnd
  );

  if (schedule.active === false || effectiveStart >= effectiveEnd) {
    return {
      ...schedule,
      active: false,
      start: minutesToTime(businessStart),
      end: minutesToTime(businessEnd),
      break_start: undefined,
      break_end: undefined,
    };
  }

  const effectiveSchedule: ProfessionalDaySchedule = {
    ...schedule,
    active: true,
    start: minutesToTime(effectiveStart),
    end: minutesToTime(effectiveEnd),
  };

  if (schedule.break_start && schedule.break_end) {
    const breakStart = Math.max(timeToMinutes(schedule.break_start), effectiveStart);
    const breakEnd = Math.min(timeToMinutes(schedule.break_end), effectiveEnd);
    if (breakStart < breakEnd) {
      effectiveSchedule.break_start = minutesToTime(breakStart);
      effectiveSchedule.break_end = minutesToTime(breakEnd);
    } else {
      delete effectiveSchedule.break_start;
      delete effectiveSchedule.break_end;
    }
  }

  return effectiveSchedule;
};

export const getEffectiveProfessionalDaySchedule = (
  prof: { weekly_schedule?: WeeklySchedule | null },
  dateStr: string,
  businessHours?: BusinessHoursConfig
): ProfessionalDaySchedule | null => {
  const schedule = getProfessionalDaySchedule(prof, dateStr);
  if (!businessHours) return schedule;
  return clampProfessionalScheduleToBusinessHours(
    schedule,
    getDayBusinessHours(dateStr, businessHours)
  );
};

/**
 * Normaliza o nome da categoria de um serviço (TitleCase, sem espaços extras)
 * Ex: 'cabelo', 'Cabelo', 'CABELO', 'cabelo ' -> 'Cabelo'
 */
export const normalizeCategoryName = (category?: string | null): string => {
  if (!category || !category.trim()) return 'Outro';
  const trimmed = category.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};
