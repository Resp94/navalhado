import { describe, expect, it } from 'vitest';
import { SupabaseExportacaoAdapter, TAMANHO_DA_PAGINA } from '../adapters/SupabaseExportacaoAdapter';

interface Chamada {
  tabela: string;
  colunas: string;
  tenant: string | null;
  ordem: string | null;
  de: number;
  ate: number;
}

/** O que o adaptador usa do cliente do Supabase: from(tabela).select(colunas).eq('tenant_id', ...).order('id').range(de, ate). */
function clienteFalso(tabelas: Record<string, Record<string, unknown>[]>, tabelaComErro?: string) {
  const chamadas: Chamada[] = [];
  const client = {
    from(tabela: string) {
      return {
        select(colunas: string) {
          const estado = { tenant: null as string | null, ordem: null as string | null };
          const consulta = {
            eq(coluna: string, valor: string) {
              if (coluna === 'tenant_id') estado.tenant = valor;
              return consulta;
            },
            order(coluna: string) {
              estado.ordem = coluna;
              return consulta;
            },
            range(de: number, ate: number) {
              chamadas.push({ tabela, colunas, ...estado, de, ate });
              if (tabela === tabelaComErro) return Promise.resolve({ data: null, error: new Error('o banco falhou') });
              const linhas = (tabelas[tabela] ?? []).filter((linha) => linha.tenant_id === estado.tenant).slice(de, ate + 1);
              return Promise.resolve({ data: linhas, error: null });
            },
          };
          return consulta;
        },
      };
    },
  };
  return { client: client as never, chamadas };
}

const linhasDeClientes = (tenant: string, quantas: number) =>
  Array.from({ length: quantas }, (_, indice) => ({
    id: `${tenant}-${String(indice).padStart(5, '0')}`,
    tenant_id: tenant,
    name: `Cliente ${indice}`,
    tags: null,
  }));

describe('SupabaseExportacaoAdapter', () => {
  it('lê página por página até acabar, só da barbearia, em ordem estável', async () => {
    const { client, chamadas } = clienteFalso({
      customers: [...linhasDeClientes('tenant-a', 2300), ...linhasDeClientes('tenant-b', 5)],
    });

    const clientes = await new SupabaseExportacaoAdapter(client).listarClientes('tenant-a');

    expect(clientes).toHaveLength(2300);
    expect(new Set(clientes.map((cliente) => cliente.id)).size).toBe(2300);
    expect(chamadas.map(({ de, ate }) => [de, ate])).toEqual([
      [0, TAMANHO_DA_PAGINA - 1],
      [TAMANHO_DA_PAGINA, 2 * TAMANHO_DA_PAGINA - 1],
      [2 * TAMANHO_DA_PAGINA, 3 * TAMANHO_DA_PAGINA - 1],
    ]);
    expect(chamadas.every((chamada) => chamada.tenant === 'tenant-a' && chamada.ordem === 'id')).toBe(true);
  });

  it('uma página inteira pede mais uma, que volta vazia', async () => {
    const { client, chamadas } = clienteFalso({ customers: linhasDeClientes('tenant-a', TAMANHO_DA_PAGINA) });

    const clientes = await new SupabaseExportacaoAdapter(client).listarClientes('tenant-a');

    expect(clientes).toHaveLength(TAMANHO_DA_PAGINA);
    expect(chamadas).toHaveLength(2);
  });

  it('pede só as colunas que vão para o arquivo: nunca todas (*) e nunca o token de acesso do cliente', async () => {
    const { client, chamadas } = clienteFalso({});
    const adaptador = new SupabaseExportacaoAdapter(client);

    await Promise.all([
      adaptador.listarClientes('t'),
      adaptador.listarAgendamentos('t'),
      adaptador.listarComandas('t'),
      adaptador.listarItensDeComandas('t'),
      adaptador.listarPagamentosDeComandas('t'),
      adaptador.listarProfissionais('t'),
      adaptador.listarServicos('t'),
      adaptador.listarProdutos('t'),
    ]);

    expect(chamadas.map((chamada) => chamada.tabela).sort()).toEqual([
      'appointments',
      'comanda_itens',
      'comanda_pagamentos',
      'comandas',
      'customers',
      'products',
      'professionals',
      'services',
    ]);
    for (const { colunas } of chamadas) {
      expect(colunas).not.toBe('*');
      expect(colunas.toLowerCase()).not.toContain('token');
    }
  });

  it('as etiquetas que o banco devolve nulas viram lista vazia', async () => {
    const { client } = clienteFalso({ customers: linhasDeClientes('tenant-a', 1) });

    const [cliente] = await new SupabaseExportacaoAdapter(client).listarClientes('tenant-a');

    expect(cliente.tags).toEqual([]);
  });

  it('valor em dinheiro que chega como texto vira número', async () => {
    const { client } = clienteFalso({
      comandas: [{ id: 'cm1', tenant_id: 'tenant-a', total_amount: '70.50', discount_amount: '5.00', tip_amount: '0', discount_percent: null }],
      comanda_itens: [{ id: 'i1', tenant_id: 'tenant-a', comanda_id: 'cm1', quantity: 2, unit_price: '12.50', total_price: '25.00' }],
      comanda_pagamentos: [{ id: 'p1', tenant_id: 'tenant-a', comanda_id: 'cm1', amount: '50.00', change_amount: '0.50' }],
    });
    const adaptador = new SupabaseExportacaoAdapter(client);

    const [comanda] = await adaptador.listarComandas('tenant-a');
    const [item] = await adaptador.listarItensDeComandas('tenant-a');
    const [pagamento] = await adaptador.listarPagamentosDeComandas('tenant-a');

    expect([comanda.total_amount, comanda.discount_amount, comanda.tip_amount]).toEqual([70.5, 5, 0]);
    expect([item.unit_price, item.total_price]).toEqual([12.5, 25]);
    expect([pagamento.amount, pagamento.change_amount]).toEqual([50, 0.5]);
  });

  it('o erro do banco sobe, em vez de virar um arquivo incompleto', async () => {
    const { client } = clienteFalso({}, 'appointments');

    await expect(new SupabaseExportacaoAdapter(client).listarAgendamentos('tenant-a')).rejects.toThrow('o banco falhou');
  });
});
