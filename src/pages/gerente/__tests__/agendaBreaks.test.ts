import { describe, it, expect } from 'vitest';
import {
  getProfessionalDaySchedule,
  isProfessionalOnBreak,
  isProfessionalWorkingAt,
} from '../Agenda';
import type { Professional } from '../Agenda';

describe('Agenda: Regras de Intervalo e Disponibilidade de Profissionais', () => {
  const mockProfessional: Professional = {
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

    it('retorna null ou active: false para dia sem expediente', () => {
      // 2026-08-23 é Domingo
      const sched = getProfessionalDaySchedule(mockProfessional, '2026-08-23');
      expect(sched?.active).toBe(false);
    });
  });

  describe('isProfessionalOnBreak', () => {
    it('retorna true quando o horário estiver dentro do intervalo (12:00 às 13:00)', () => {
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '12:00')).toBe(true);
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '12:20')).toBe(true);
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '12:40')).toBe(true);
    });

    it('retorna false quando o horário estiver fora do intervalo', () => {
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '09:00')).toBe(false);
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '11:40')).toBe(false);
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '13:00')).toBe(false);
      expect(isProfessionalOnBreak(mockProfessional, '2026-08-22', '14:20')).toBe(false);
    });

    it('retorna false caso o profissional não tenha weekly_schedule', () => {
      const profWithoutSchedule: Professional = {
        id: 'prof-2',
        name: 'Sem Agenda',
        is_active: true,
      };
      expect(isProfessionalOnBreak(profWithoutSchedule, '2026-08-22', '12:00')).toBe(false);
    });
  });

  describe('isProfessionalWorkingAt', () => {
    it('retorna true dentro do expediente e fora do intervalo', () => {
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '09:00')).toBe(true);
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '11:40')).toBe(true);
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '13:00')).toBe(true);
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '14:20')).toBe(true);
    });

    it('retorna false durante o horário de intervalo', () => {
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '12:00')).toBe(false);
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '12:30')).toBe(false);
    });

    it('retorna false fora do horário de início ou término de trabalho', () => {
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '08:00')).toBe(false);
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '15:00')).toBe(false);
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '18:00')).toBe(false);
    });

    it('retorna false em dia de folga (active: false)', () => {
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-23', '10:00')).toBe(false);
    });

    it('retorna false para profissional inativo', () => {
      const inactiveProf: Professional = {
        ...mockProfessional,
        is_active: false,
      };
      expect(isProfessionalWorkingAt(inactiveProf, '2026-08-22', '10:00')).toBe(false);
    });
  });
});
