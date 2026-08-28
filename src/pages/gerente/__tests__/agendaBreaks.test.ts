import { describe, it, expect } from 'vitest';
import {
  getProfessionalDaySchedule,
  isProfessionalOnBreak,
  isProfessionalWorkingAt,
  getProfessionalBreakMessage,
  addMinutesToTime,
  timeToMinutes,
  generateTimeSlotsForSchedule,
} from '../../../lib/schedule';
import type { ScheduleProfessional } from '../../../lib/schedule';

describe('Agenda & Schedule: Regras de Intervalo e Disponibilidade com Duração', () => {
  const mockProfessional: ScheduleProfessional = {
    id: 'prof-1',
    name: 'Carlos Barbeiro',
    is_active: true,
    weekly_schedule: {
      monday: {
        active: true,
        start: '09:00',
        end: '18:00',
        break_start: '12:00',
        break_end: '13:00',
      },
      saturday: {
        active: true,
        start: '09:00',
        end: '15:00',
        break_start: '12:00',
        break_end: '13:00',
      },
      sunday: {
        active: false,
        start: '09:00',
        end: '13:00',
        break_start: '12:00',
        break_end: '13:00',
      },
    },
  };

  describe('getProfessionalDaySchedule', () => {
    it('retorna o schedule correto para dia ativo', () => {
      // 2026-08-22 é Sábado
      const sched = getProfessionalDaySchedule(mockProfessional, '2026-08-22');
      expect(sched).toBeDefined();
      expect(sched?.active).toBe(true);
      expect(sched?.break_start).toBe('12:00');
      expect(sched?.break_end).toBe('13:00');
    });

    it('retorna schedule com active: false para dia sem expediente', () => {
      // 2026-08-23 é Domingo
      const sched = getProfessionalDaySchedule(mockProfessional, '2026-08-23');
      expect(sched?.active).toBe(false);
    });
  });

  describe('isProfessionalOnBreak com duração de serviço', () => {
    it('retorna true quando o slot está dentro do intervalo', () => {
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '12:00')).toBe(true);
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '12:30')).toBe(true);
    });

    it('retorna true quando um serviço iniciado antes do almoço invade o intervalo', () => {
      // Serviço de 45 min iniciado às 11:30 termina às 12:15 (invade o almoço das 12:00-13:00)
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '11:30', 45)).toBe(true);
      // Serviço de 60 min iniciado às 11:15 termina às 12:15
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '11:15', 60)).toBe(true);
    });

    it('retorna false quando um serviço antes do almoço termina exatamente ou antes do início do intervalo', () => {
      // Serviço de 30 min iniciado às 11:30 termina às 12:00
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '11:30', 30)).toBe(false);
      // Serviço de 45 min iniciado às 11:00 termina às 11:45
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '11:00', 45)).toBe(false);
    });

    it('retorna false quando o horário de início é no término do intervalo', () => {
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '13:00', 30)).toBe(false);
    });
  });

  describe('isProfessionalWorkingAt com limite de expediente e folga', () => {
    it('retorna true quando serviço cabe completamente no expediente e fora do almoço', () => {
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '09:00', 30)).toBe(true);
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '13:00', 60)).toBe(true);
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '14:00', 60)).toBe(true); // Termina às 15:00
    });

    it('retorna true quando o início está antes do fechamento mesmo que o serviço termine depois', () => {
      // Sábado fecha às 15:00. O horário 14:30 ainda começa antes do fechamento.
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '14:30', 40)).toBe(true);
    });

    it('retorna false se o serviço invade o intervalo', () => {
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '11:40', 30)).toBe(false);
    });

    it('retorna false em dia de folga ou profissional inativo', () => {
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-23', '10:00')).toBe(false);
      const inactive = { ...mockProfessional, is_active: false };
      expect(isProfessionalWorkingAt(inactive, '2026-08-22', '10:00')).toBe(false);
    });
  });

  describe('getProfessionalBreakMessage', () => {
    it('formata a mensagem com os horários de início e término', () => {
      const msg = getProfessionalBreakMessage(mockProfessional, '2026-08-22');
      expect(msg).toBe('O profissional Carlos Barbeiro está em horário de intervalo (12:00 às 13:00).');
    });
  });

  describe('addMinutesToTime e timeToMinutes', () => {
    it('calcula conversões e adições de minutos com precisão', () => {
      expect(timeToMinutes('09:30')).toBe(570);
      expect(addMinutesToTime('09:30', 45)).toBe('10:15');
      expect(addMinutesToTime('11:45', 30)).toBe('12:15');
    });
  });

  describe('generateTimeSlotsForSchedule: reinício da grade após break_end', () => {
    it('gera slots de manhã até o início do intervalo e reinicia a grade exatamente no término do intervalo', () => {
      // Exemplo solicitado por Jonathas:
      // Expediente: 08:00 às 18:00, Intervalo: 12:00 às 13:00, Grade: 40min
      const slots = generateTimeSlotsForSchedule('08:00', '18:00', 40, '12:00', '13:00');

      // Manhã
      expect(slots).toContain('08:00');
      expect(slots).toContain('08:40');
      expect(slots).toContain('09:20');
      expect(slots).toContain('10:00');
      expect(slots).toContain('10:40');
      expect(slots).toContain('11:20');

      // Intervalo (12:00 às 13:00) NÃO deve conter slots
      expect(slots).not.toContain('12:00');
      expect(slots).not.toContain('12:40');

      // Retorno do intervalo (13:00) DEVE estar disponível e a grade conta novamente a partir de 13:00
      expect(slots).toContain('13:00');
      expect(slots).toContain('13:40');
      expect(slots).toContain('14:20');
      expect(slots).toContain('15:00');
      expect(slots).toContain('15:40');
      expect(slots).toContain('16:20');
      expect(slots).toContain('17:00');
      // O último início antes do fechamento é permitido, mesmo que o atendimento ultrapasse 18:00
      expect(slots).toContain('17:40');
      expect(slots).not.toContain('18:20');
      expect(slots).not.toContain('13:20');
    });

    it('funciona perfeitamente quando não há intervalo configurado', () => {
      const slots = generateTimeSlotsForSchedule('08:00', '10:00', 30);
      expect(slots).toEqual(['08:00', '08:30', '09:00', '09:30']);
    });
  });
});
