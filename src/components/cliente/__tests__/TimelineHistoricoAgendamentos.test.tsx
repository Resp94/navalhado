import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimelineHistoricoAgendamentos } from '../TimelineHistoricoAgendamentos';

describe('TimelineHistoricoAgendamentos', () => {
  it('exibe dia e mês na timeline e mantém a data fora do card', () => {
    render(
      <TimelineHistoricoAgendamentos
        timezone="America/Manaus"
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

    const card = screen.getByRole('article');
    expect(card).not.toHaveTextContent('11/08');
    expect(card).toHaveTextContent('17:00');
  });

  it('mostra o horário no fuso da barbearia, não no do navegador de quem acessa (spec 044)', () => {
    // 23:30 UTC é 20:30 em America/Sao_Paulo (UTC-3) e 19:30 em America/Manaus (UTC-4):
    // o texto exibido depende só da prop timezone, nunca do relógio do ambiente que roda o teste.
    render(
      <TimelineHistoricoAgendamentos
        timezone="America/Sao_Paulo"
        appointments={[{
          appointment_id: 'appointment-2',
          start_time: '2026-09-22T23:30:00.000Z',
          end_time: '2026-09-22T23:59:00.000Z',
          status: 'canceled',
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
        }]}
      />,
    );

    expect(screen.getByRole('article')).toHaveTextContent('20:30');
  });
});
