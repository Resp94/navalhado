import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClienteAdapter } from '../SupabaseClienteAdapter';

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
