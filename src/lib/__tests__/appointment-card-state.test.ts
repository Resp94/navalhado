import { describe, expect, it } from 'vitest';
import { getAppointmentCardState } from '../appointment-card-state';

describe('estado visual do card de encaixe', () => {
  it('não considera um encaixe pago como concluído enquanto o atendimento não estiver concluído', () => {
    expect(getAppointmentCardState({
      isFitting: true,
      appointmentStatus: 'confirmed',
      paymentStatus: 'paid',
    })).toBe('fitting');
  });

  it('considera o encaixe concluído somente com atendimento concluído e pagamento confirmado', () => {
    expect(getAppointmentCardState({
      isFitting: true,
      appointmentStatus: 'completed',
      paymentStatus: 'paid',
    })).toBe('completed');
  });

  it('não deixa um atendimento concluído sem pagamento com o estado verde', () => {
    expect(getAppointmentCardState({
      isFitting: true,
      appointmentStatus: 'completed',
      paymentStatus: 'pending',
    })).toBe('fitting');
  });

  it('preserva a regra anterior para agendamentos normais pagos ou concluídos', () => {
    expect(getAppointmentCardState({
      isFitting: false,
      appointmentStatus: 'confirmed',
      paymentStatus: 'paid',
    })).toBe('completed');
    expect(getAppointmentCardState({
      isFitting: false,
      appointmentStatus: 'completed',
      paymentStatus: 'pending',
    })).toBe('completed');
  });
});
