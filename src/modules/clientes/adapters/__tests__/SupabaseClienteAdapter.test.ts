import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClienteAdapter } from '../SupabaseClienteAdapter';
import { colunasDeTopo, projetarColunas } from '../../../../test/fakePostgrestColunas';

function fakeSupabase(rows: unknown[]) {
  const query: any = {
    select: () => query,
    eq: () => query,
    order: () => Promise.resolve({ data: rows, error: null }),
  };
  return { from: () => query } as unknown as SupabaseClient;
}

describe('SupabaseClienteAdapter.buscarHistoricoComandas', () => {
  it('não reaplica desconto e gorjeta sobre total_amount, que já é o total cobrado', async () => {
    // finalizar_comanda grava total_amount = subtotal 80 - desconto 10 + gorjeta 20
    const adapter = new SupabaseClienteAdapter(
      fakeSupabase([
        {
          id: 'cmd1',
          appointment_id: 'appt1',
          status: 'fechada',
          total_amount: '90.00',
          discount_amount: '10.00',
          tip_amount: '20.00',
          closed_at: '2026-03-10T14:00:00Z',
          created_at: '2026-03-10T13:00:00Z',
          comanda_itens: [],
        },
      ])
    );

    const [cmd] = await adapter.buscarHistoricoComandas('tenant-1', 'c1');

    expect(cmd.status).toBe('fechada');
    expect(cmd.total_final).toBe(90);
    expect(cmd.tip_amount).toBe(20);
    expect(cmd.appointment_id).toBe('appt1');
  });
});

/**
 * Como o PostgREST: só devolve as colunas pedidas no select. Um fake que devolvesse a linha
 * inteira esconderia justamente o defeito de esquecer uma coluna na consulta.
 */
function fakeSupabaseQueRespeitaSelect(rows: Array<Record<string, unknown>>) {
  let colunasPedidas: string[] = [];
  const query: any = {
    select: (colunas: string) => {
      colunasPedidas = colunasDeTopo(colunas);
      return query;
    },
    eq: () => query,
    order: () =>
      Promise.resolve({
        data: rows.map((row) => projetarColunas(colunasPedidas, row)),
        error: null,
      }),
  };
  return { from: () => query } as unknown as SupabaseClient;
}

describe('SupabaseClienteAdapter.buscarHistoricoVisitas', () => {
  const agendamento = {
    id: 'a1',
    start_time: '2026-09-10T14:00:00Z',
    status: 'canceled',
    payment_status: 'pending',
    services: { name: 'Corte', price: 45 },
    professionals: { name: 'Lucas' },
  };

  it('traz o motivo do cancelamento gravado no Agendamento', async () => {
    const adapter = new SupabaseClienteAdapter(
      fakeSupabaseQueRespeitaSelect([{ ...agendamento, cancellation_reason: 'Cliente desistiu' }])
    );

    const [visita] = await adapter.buscarHistoricoVisitas('c1');

    expect(visita.cancellation_reason).toBe('Cliente desistiu');
  });

  it('trata motivo só com espaços como ausente e apara o motivo real', async () => {
    const adapter = new SupabaseClienteAdapter(
      fakeSupabaseQueRespeitaSelect([
        { ...agendamento, id: 'a-vazio', cancellation_reason: '   ' },
        { ...agendamento, id: 'a-real', cancellation_reason: '  Imprevisto no trabalho ' },
      ])
    );

    const visitas = await adapter.buscarHistoricoVisitas('c1');

    expect(visitas.find((v) => v.id === 'a-vazio')?.cancellation_reason).toBeNull();
    expect(visitas.find((v) => v.id === 'a-real')?.cancellation_reason).toBe('Imprevisto no trabalho');
  });

  it('devolve nulo, e não indefinido, quando o cancelamento não tem motivo', async () => {
    const adapter = new SupabaseClienteAdapter(
      fakeSupabaseQueRespeitaSelect([{ ...agendamento, cancellation_reason: null }])
    );

    const [visita] = await adapter.buscarHistoricoVisitas('c1');

    expect(visita.cancellation_reason).toBeNull();
  });
});
