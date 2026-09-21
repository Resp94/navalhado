import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseEsperaAdapter } from '../SupabaseEsperaAdapter';

const LINHA_DO_BANCO = {
  id: 'w-1',
  tenant_id: 't-1',
  customer_id: null,
  name: 'Paulo Vieira',
  phone: '11999998888',
  service_id: null,
  professional_id: null,
  status: 'waiting',
  notes: null,
  created_at: '2026-09-21T14:00:00.000Z',
};

describe('SupabaseEsperaAdapter', () => {
  const insert = vi.fn();
  const order = vi.fn();
  const from = vi.fn();

  const criarAdapter = () => new SupabaseEsperaAdapter({ from } as unknown as SupabaseClient);

  beforeEach(() => {
    vi.resetAllMocks();
    from.mockReturnValue({
      insert: insert.mockReturnValue({
        select: () => ({ single: () => Promise.resolve({ data: LINHA_DO_BANCO, error: null }) }),
      }),
      select: () => ({
        eq: () => ({ gte: () => ({ lte: () => ({ order }) }) }),
      }),
    });
  });

  describe('observação da entrada (spec 043, ticket 01)', () => {
    it('envia a observação na carga de inserção', async () => {
      await criarAdapter().adicionar({
        tenant_id: 't-1',
        customer_name: 'Paulo Vieira',
        customer_phone: '11999998888',
        status: 'aguardando',
        notes: 'Só pode depois das 18h, quer o Marcos',
      });

      expect(from).toHaveBeenCalledWith('waiting_list');
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Só pode depois das 18h, quer o Marcos' })
      );
    });

    it('envia nulo, e não texto vazio, quando não há observação', async () => {
      await criarAdapter().adicionar({
        tenant_id: 't-1',
        customer_name: 'Paulo Vieira',
        customer_phone: '11999998888',
        status: 'aguardando',
        notes: '',
      });

      expect(insert.mock.calls[0][0].notes).toBeNull();
    });

    it('devolve a observação gravada na linha do banco após inserir', async () => {
      from.mockReturnValue({
        insert: insert.mockReturnValue({
          select: () => ({
            single: () =>
              Promise.resolve({ data: { ...LINHA_DO_BANCO, notes: 'Vai trazer o filho junto' }, error: null }),
          }),
        }),
      });

      const entrada = await criarAdapter().adicionar({
        tenant_id: 't-1',
        customer_name: 'Paulo Vieira',
        customer_phone: '11999998888',
        status: 'aguardando',
        notes: 'Vai trazer o filho junto',
      });

      expect(entrada.notes).toBe('Vai trazer o filho junto');
    });

    it('lê a observação de volta ao listar as entradas do dia', async () => {
      order.mockResolvedValueOnce({
        data: [{ ...LINHA_DO_BANCO, notes: 'Quer o Marcos, aceita esperar' }],
        error: null,
      });

      const [entrada] = await criarAdapter().listarPorData('t-1', '2026-09-21');

      expect(entrada.notes).toBe('Quer o Marcos, aceita esperar');
    });
  });
});
