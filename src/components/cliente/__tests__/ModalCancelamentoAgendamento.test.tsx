import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModalCancelamentoAgendamento } from '../ModalCancelamentoAgendamento';
import type { AgendamentoCanal } from '../../../modules/canal-cliente/types';

const APPOINTMENT: AgendamentoCanal = {
  appointment_id: 'appointment-1',
  start_time: '2026-09-22T23:30:00.000Z',
  end_time: '2026-09-22T23:59:00.000Z',
  status: 'confirmed',
  payment_status: 'pending',
  cancellation_reason: null,
  professional_name: 'Matheus Lopes',
  professional_id: 'professional-1',
  service_name: 'Corte',
  service_id: 'service-1',
  service_price: 50,
  service_duration: 30,
  tenant_name: 'Barbearia Brooklyn',
  tenant_id: 'tenant-1',
  tenant_phone: '92999999999',
  customer_name: 'Cliente Teste',
};

describe('ModalCancelamentoAgendamento', () => {
  it('mostra o horário no fuso da barbearia, não no do navegador de quem acessa (spec 044)', () => {
    // 23:30 UTC, terça, é 20:30 de terça em America/Sao_Paulo (UTC-3): o texto exibido depende só
    // da prop timezone, nunca do relógio do ambiente que roda o teste.
    render(
      <ModalCancelamentoAgendamento
        isOpen
        onClose={vi.fn()}
        appointment={APPOINTMENT}
        timezone="America/Sao_Paulo"
        cancelReason=""
        onChangeReason={vi.fn()}
        onConfirmCancel={vi.fn()}
        canceling={false}
      />
    );

    expect(screen.getByText(/Terça, 22\/09 às 20:30/)).toBeInTheDocument();
  });
});
