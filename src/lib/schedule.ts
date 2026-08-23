export interface ProfessionalDaySchedule {
  active?: boolean;
  start?: string;
  end?: string;
  break_start?: string;
  break_end?: string;
}

export type WeeklySchedule = Record<string, ProfessionalDaySchedule>;

export interface ScheduleProfessional {
  id: string;
  name: string;
  is_active: boolean;
  weekly_schedule?: WeeklySchedule | null;
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

/**
 * Adiciona minutos a um horário no formato "HH:MM"
 */
export const addMinutesToTime = (timeStr: string, minutes: number): string => {
  return minutesToTime(timeToMinutes(timeStr) + minutes);
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
  prof: ScheduleProfessional,
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
  durationMinutes: number = 0
): boolean => {
  if (!prof.is_active) return false;
  const schedule = getProfessionalDaySchedule(prof, dateStr);
  if (!schedule) return true; // Sem escala explícita, considera disponível dentro do funcionamento geral
  if (schedule.active === false) return false;

  const slotStartMin = timeToMinutes(timeSlot);
  const effectiveDuration = durationMinutes > 0 ? durationMinutes : 1;
  const slotEndMin = slotStartMin + effectiveDuration;

  if (schedule.start && slotStartMin < timeToMinutes(schedule.start)) return false;
  if (schedule.end && slotEndMin > timeToMinutes(schedule.end)) return false;

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

  const hasBreak = Boolean(breakStart && breakEnd && timeToMinutes(breakStart!) < timeToMinutes(breakEnd!));
  const bStartMin = hasBreak ? timeToMinutes(breakStart!) : endMin;
  const bEndMin = hasBreak ? timeToMinutes(breakEnd!) : endMin;

  // 1. Manhã / Período antes do intervalo (do start até o breakStart)
  for (let m = startMin; m < Math.min(bStartMin, endMin); m += step) {
    slots.push(minutesToTime(m));
  }

  // 2. Tarde / Período pós-intervalo: reinicia a grade estritamente no breakEnd
  if (hasBreak && bEndMin < endMin) {
    for (let m = bEndMin; m < endMin; m += step) {
      slots.push(minutesToTime(m));
    }
  }

  return slots;
};

/**
 * Obtém o horário de funcionamento da barbearia para determinada data
 */
export const getDayBusinessHours = (
  dateStr: string,
  businessHours?: Record<string, { active: boolean; open: string; close: string }>
) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayIndex = dateObj.getDay();
  const key = PT_DAY_KEYS[dayIndex];

  const defaultBh: Record<string, { active: boolean; open: string; close: string }> = {
    segunda: { active: true, open: '09:00', close: '18:00' },
    terca: { active: true, open: '09:00', close: '18:00' },
    quarta: { active: true, open: '09:00', close: '18:00' },
    quinta: { active: true, open: '09:00', close: '18:00' },
    sexta: { active: true, open: '09:00', close: '18:00' },
    sabado: { active: true, open: '09:00', close: '15:00' },
    domingo: { active: false, open: '09:00', close: '12:00' },
  };

  return businessHours?.[key] || defaultBh[key] || { active: true, open: '09:00', close: '18:00' };
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
