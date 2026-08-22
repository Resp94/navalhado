import { describe, it, expect } from 'vitest';
import {
  getProfessionalDaySchedule,
  isProfessionalOnBreak,
  isProfessionalWorkingAt,
  getProfessionalBreakMessage,
  addMinutesToTime,
  timeToMinutes,
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

    it('retorna false se o serviço ultrapassa o horário de término do expediente', () => {
      // Sábado fecha às 15:00. Serviço de 40 min às 14:30 termina às 15:10
      expect(isProfessionalWorkingAt(mockProfessional, '2026-08-22', '14:30', 40)).toBe(false);
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
});
