import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimelineHistoricoAgendamentos } from '../TimelineHistoricoAgendamentos';

describe('TimelineHistoricoAgendamentos', () => {
  it('exibe dia e mês na timeline e mantém a data fora do card', () => {
    render(
      <TimelineHistoricoAgendamentos
        appointments={[{
          appointment_id: 'appointment-1',
          start_time: '2026-08-11T17:00:00-04:00',
          end_time: '2026-08-11T17:40:00-04:00',
          status: 'completed',
          payment_status: 'paid',
          cancellation_reason: null,
          professional_name: 'Matheus Lopes',
          professional_id: 'professional-1',
          service_name: 'Corte + Barba',
          service_id: 'service-1',
          service_price: 80,
          service_duration: 40,
          tenant_name: 'Barbearia Brooklyn',
          tenant_id: 'tenant-1',
          tenant_phone: '92999999999',
          customer_name: 'Cliente Teste',
        }]}
      />,
    );

    expect(screen.getByText('Agosto de 2026')).toBeInTheDocument();
    expect(screen.getByText('11/08')).toBeInTheDocument();

    const card = document.querySelector('.timeline-entry__card');
    expect(card).not.toBeNull();
    expect(card).not.toHaveTextContent('11/08');
    expect(card).toHaveTextContent('17:00');
  });
});
