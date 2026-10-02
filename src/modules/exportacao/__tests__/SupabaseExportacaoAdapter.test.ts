import { describe, expect, it } from 'vitest';
import { colunasDeTopo, projetarColunas } from '../../../test/fakePostgrestColunas';
import { ExportacaoRepository } from '../ExportacaoRepository';
import { SupabaseExportacaoAdapter, TAMANHO_DA_PAGINA } from '../adapters/SupabaseExportacaoAdapter';

type Linha = Record<string, unknown>;

interface Chamada {
  tabela: string;
  colunas: string;
  tenant: string | null;
  depoisDe: string | null;
  ordem: string | null;
  limite: number | null;
  sinal: AbortSignal | null;
}

interface OpcoesDoFalso {
  tabelaComErro?: string;
  /** O "Max rows" da API do projeto: o servidor devolve no máximo isto, por mais que se peça. */
  maximoDoServidor?: number;
  /** Roda quando um pedido chega ao servidor, antes de ele responder: é onde o teste mexe nas tabelas "ao vivo". */
  aoPedir?: (chamada: Chamada) => void;
}

interface ChamadaDeRpc {
  nome: string;
  argumentos: Record<string, unknown>;
}

/**
 * O que o adaptador usa do cliente do Supabase: from(tabela).select(colunas).eq('tenant_id', ...).gt('id', ...).order('id').limit(n)
 * (com .abortSignal(sinal) quando há sinal) e rpc(nome, argumentos). Como o PostgREST: só devolve as colunas pedidas no select (um
 * fake que devolvesse a linha inteira esconderia o defeito de esquecer uma coluna), ordena por `id`, aplica `gt` e `limit` e não
 * devolve mais que o "Max rows" do servidor.
 */
function clienteFalso(tabelas: Record<string, Linha[]>, { tabelaComErro, maximoDoServidor, aoPedir }: OpcoesDoFalso = {}, erroDeRpc?: Error) {
  const chamadas: Chamada[] = [];
  const rpcs: ChamadaDeRpc[] = [];
  const client = {
    from(tabela: string) {
      return {
        select(colunas: string) {
          const estado = { tenant: null as string | null, depoisDe: null as string | null, ordem: null as string | null, limite: null as number | null, sinal: null as AbortSignal | null };
          const executar = async () => {
            const chamada = { tabela, colunas, ...estado };
            chamadas.push(chamada);
            aoPedir?.(chamada);
            if (estado.sinal?.aborted) return { data: null, error: new Error('AbortError: a leitura foi cancelada') };
            if (tabela === tabelaComErro) return { data: null, error: new Error('o banco falhou') };

            const doTenant = (tabelas[tabela] ?? []).filter((linha) => linha.tenant_id === estado.tenant);
            const emOrdem = [...doTenant].sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
            const depois = estado.depoisDe === null ? emOrdem : emOrdem.filter((linha) => String(linha.id) > String(estado.depoisDe));
            const pagina = depois.slice(0, Math.min(estado.limite ?? Infinity, maximoDoServidor ?? Infinity));
            const pedidas = colunasDeTopo(colunas);
            return { data: pagina.map((linha) => projetarColunas(pedidas, linha)), error: null };
          };
          const consulta = {
            eq(coluna: string, valor: string) {
              if (coluna === 'tenant_id') estado.tenant = valor;
              return consulta;
            },
            gt(coluna: string, valor: string) {
              if (coluna === 'id') estado.depoisDe = valor;
              return consulta;
            },
            order(coluna: string) {
              estado.ordem = coluna;
              return consulta;
            },
            limit(quantas: number) {
              estado.limite = quantas;
              return consulta;
            },
            abortSignal(sinal: AbortSignal) {
              estado.sinal = sinal;
              return consulta;
            },
            then(resolver: (resposta: unknown) => unknown, rejeitar: (erro: unknown) => unknown) {
              return executar().then(resolver, rejeitar);
            },
          };
          return consulta;
        },
      };
    },
    rpc(nome: string, argumentos: Record<string, unknown>) {
      rpcs.push({ nome, argumentos });
      return Promise.resolve({ data: null, error: erroDeRpc ?? null });
    },
  };
  return { client: client as never, chamadas, rpcs };
}

const idDe = (tenant: string, indice: number) => `${tenant}-${String(indice).padStart(5, '0')}`;

const linhasDeClientes = (tenant: string, quantas: number): Linha[] =>
  Array.from({ length: quantas }, (_, indice) => ({
    id: idDe(tenant, indice),
    tenant_id: tenant,
    name: `Cliente ${indice}`,
    tags: [],
  }));

describe('SupabaseExportacaoAdapter', () => {
  describe('leitura por chave', () => {
    it('lê página por página, a partir do último ID lido, até uma página vir vazia, só da barbearia', async () => {
      const { client, chamadas } = clienteFalso({
        customers: [...linhasDeClientes('tenant-a', 2300), ...linhasDeClientes('tenant-b', 5)],
      });

      const clientes = await new SupabaseExportacaoAdapter(client).listarClientes('tenant-a');

      expect(clientes).toHaveLength(2300);
      expect(new Set(clientes.map((cliente) => cliente.id)).size).toBe(2300);
      expect(chamadas.map((chamada) => chamada.depoisDe)).toEqual([
        null,
        idDe('tenant-a', 999),
        idDe('tenant-a', 1999),
        idDe('tenant-a', 2299),
      ]);
      expect(chamadas.every((chamada) => chamada.tenant === 'tenant-a' && chamada.ordem === 'id' && chamada.limite === TAMANHO_DA_PAGINA)).toBe(true);
    });

    it('uma barbearia sem linhas faz um só pedido', async () => {
      const { client, chamadas } = clienteFalso({});

      expect(await new SupabaseExportacaoAdapter(client).listarClientes('tenant-a')).toEqual([]);
      expect(chamadas).toHaveLength(1);
    });

    it('um servidor que devolve menos linhas que o pedido (Max rows) não corta a leitura: só uma página vazia a termina', async () => {
      const { client } = clienteFalso({ customers: linhasDeClientes('tenant-a', 1200) }, { maximoDoServidor: 500 });

      const clientes = await new SupabaseExportacaoAdapter(client).listarClientes('tenant-a');

      expect(clientes).toHaveLength(1200);
      expect(new Set(clientes.map((cliente) => cliente.id)).size).toBe(1200);
    });

    it('uma linha que entra e outra que sai entre as páginas não repetem nem pulam as que já existiam', async () => {
      const tabelas = { customers: linhasDeClientes('tenant-a', 1500) };
      const { client } = clienteFalso(tabelas, {
        aoPedir: (chamada) => {
          // Entre a primeira e a segunda página: entra um cliente cujo ID cai dentro do trecho já lido, e sai um que já foi lido.
          if (chamada.depoisDe === idDe('tenant-a', 999)) {
            tabelas.customers.push({ id: `${idDe('tenant-a', 500)}x`, tenant_id: 'tenant-a', name: 'Entrou no meio', tags: [] });
            tabelas.customers.splice(100, 1);
          }
        },
      });

      const clientes = await new SupabaseExportacaoAdapter(client).listarClientes('tenant-a');
      const ids = clientes.map((cliente) => cliente.id);

      expect(new Set(ids).size).toBe(ids.length);
      for (let indice = 0; indice < 1500; indice += 1) expect(ids).toContain(idDe('tenant-a', indice));
    });

    it('passa o sinal a cada pedido e para de ler quando ele é cancelado', async () => {
      const cancelamento = new AbortController();
      const { client, chamadas } = clienteFalso(
        { customers: linhasDeClientes('tenant-a', 2500) },
        { aoPedir: (chamada) => chamada.depoisDe !== null && cancelamento.abort() },
      );

      await expect(new SupabaseExportacaoAdapter(client).listarClientes('tenant-a', { sinal: cancelamento.signal })).rejects.toThrow();

      expect(chamadas.every((chamada) => chamada.sinal === cancelamento.signal)).toBe(true);
      expect(chamadas).toHaveLength(2);
    });

    it('um sinal já cancelado não chega a pedir nada ao banco', async () => {
      const cancelamento = new AbortController();
      cancelamento.abort();
      const { client, chamadas } = clienteFalso({ customers: linhasDeClientes('tenant-a', 3) });

      await expect(new SupabaseExportacaoAdapter(client).listarClientes('tenant-a', { sinal: cancelamento.signal })).rejects.toThrow();

      expect(chamadas).toHaveLength(0);
    });
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
    const { client } = clienteFalso({ customers: [{ id: 'c1', tenant_id: 'tenant-a', name: 'Sem etiquetas', tags: null }] });

    const [cliente] = await new SupabaseExportacaoAdapter(client).listarClientes('tenant-a');

    expect(cliente.tags).toEqual([]);
  });

  it('valor em dinheiro que chega como texto vira número', async () => {
    const { client } = clienteFalso({
      comandas: [{ id: 'cm1', tenant_id: 'tenant-a', total_amount: '70.50', discount_amount: '5.00', tip_amount: '0', discount_percent: null }],
      comanda_itens: [{ id: 'i1', tenant_id: 'tenant-a', comanda_id: 'cm1', quantity: 2, unit_price: '12.50' }],
      comanda_pagamentos: [{ id: 'p1', tenant_id: 'tenant-a', comanda_id: 'cm1', amount: '50.00', change_amount: '0.50' }],
    });
    const adaptador = new SupabaseExportacaoAdapter(client);

    const [comanda] = await adaptador.listarComandas('tenant-a');
    const [item] = await adaptador.listarItensDeComandas('tenant-a');
    const [pagamento] = await adaptador.listarPagamentosDeComandas('tenant-a');

    expect([comanda.total_amount, comanda.discount_amount, comanda.tip_amount]).toEqual([70.5, 5, 0]);
    expect(item.unit_price).toBe(12.5);
    expect([pagamento.amount, pagamento.change_amount]).toEqual([50, 0.5]);
  });

  it('o erro do banco sobe, em vez de virar um arquivo incompleto', async () => {
    const { client } = clienteFalso({}, { tabelaComErro: 'appointments' });

    await expect(new SupabaseExportacaoAdapter(client).listarAgendamentos('tenant-a')).rejects.toThrow('o banco falhou');
  });

  describe('trilha de auditoria', () => {
    const detalhes = { arquivos: 3, linhas: { clientes: 10, agendamentos: 20, comandas: 5 } };

    it('registra a exportação pela função do banco que guarda quem fez, de qual barbearia e quando', async () => {
      const { client, rpcs } = clienteFalso({});

      await new SupabaseExportacaoAdapter(client).registrarExportacao(detalhes);

      expect(rpcs).toEqual([
        { nome: 'log_audit_event', argumentos: { p_action: 'tenant_data_exported', p_resource: 'tenant', p_details: detalhes } },
      ]);
    });

    it('o erro do banco sobe para quem chamou decidir (o repositório não deixa isso travar a exportação)', async () => {
      const { client } = clienteFalso({}, {}, new Error('permission denied'));

      await expect(new SupabaseExportacaoAdapter(client).registrarExportacao(detalhes)).rejects.toThrow('permission denied');
    });
  });

  // O repositório e o adaptador juntos, sobre linhas com o formato do banco: se uma coluna que o arquivo usa sair da lista do select,
  // o fake (que só devolve o que se pede) a esconde e a célula sai vazia ou "NaN".
  describe('com o repositório, o arquivo leva tudo o que o select pede', () => {
    const TENANT = 'tenant-a';

    const tabelas = (): Record<string, Linha[]> => ({
      customers: [
        {
          id: 'c1', tenant_id: TENANT, name: 'João da Conceição', phone: '92999990001', email: 'joao@exemplo.com', cpf: '12345678909', birth_date: '1990-03-05',
          tags: ['VIP'], acquisition_channel: 'Instagram', registration_origin: 'whatsapp_bot', cadastro_completo: true, notes: 'Prefere tarde',
          created_at: '2026-01-10T15:30:00Z', token_acesso: 'token-secreto-do-cliente',
        },
      ],
      appointments: [
        {
          id: 'a1', tenant_id: TENANT, customer_id: 'c1', professional_id: 'p1', service_id: 's1', start_time: '2026-10-01T23:30:00Z', end_time: '2026-10-02T00:15:00Z',
          status: 'completed', payment_status: 'paid', origin: 'manual', is_fitting: true, from_waiting_list: true, canceled_by: 'shop', cancellation_reason: 'Motivo X',
          notes: 'Observação do agendamento', created_at: '2026-09-30T14:00:00Z',
        },
      ],
      comandas: [
        {
          id: '1a2b3c4d-0000-4000-8000-000000000001', tenant_id: TENANT, appointment_id: 'a1', customer_id: 'c1', status: 'fechada', total_amount: '70.50',
          discount_amount: '5.00', discount_type: 'percent', discount_percent: '10', tip_amount: '3.25', tip_professional_id: 'p1', notes: 'Observação da comanda',
          created_at: '2026-10-01T23:40:00Z', closed_at: '2026-10-02T00:20:00Z',
        },
      ],
      comanda_itens: [
        { id: 'i1', tenant_id: TENANT, comanda_id: '1a2b3c4d-0000-4000-8000-000000000001', item_type: 'servico', service_id: 's1', product_id: null, professional_id: 'p1', quantity: 2, unit_price: '35.25' },
      ],
      comanda_pagamentos: [
        { id: 'pg1', tenant_id: TENANT, comanda_id: '1a2b3c4d-0000-4000-8000-000000000001', payment_method: 'cash', amount: '80.00', change_amount: '9.50', paid_at: '2026-10-02T00:20:00Z' },
      ],
      professionals: [{ id: 'p1', tenant_id: TENANT, name: 'Zé Barbeiro' }],
      services: [{ id: 's1', tenant_id: TENANT, name: 'Corte Navalhado' }],
      products: [],
    });

    it('cliente, agendamento e comanda saem com cada coluna lida', async () => {
      const { client } = clienteFalso(tabelas());
      const arquivos = await new ExportacaoRepository(new SupabaseExportacaoAdapter(client)).gerarArquivos(TENANT, 'America/Manaus', {
        agora: new Date('2026-10-02T02:30:00Z'),
      });
      const celulas = (indice: number, linha: number) => arquivos[indice].conteudo.replace('﻿', '').split('\r\n')[linha].split(';');

      expect(celulas(0, 1)).toEqual([
        'c1', 'João da Conceição', '(92) 99999-0001', 'joao@exemplo.com', '123.456.789-09', '05/03/1990', 'VIP', 'Instagram', 'WhatsApp', 'Sim', 'Prefere tarde', '10/01/2026 11:30',
      ]);
      expect(celulas(1, 1)).toEqual([
        'a1', '01/10/2026', '19:30', '20:15', 'c1', 'João da Conceição', '(92) 99999-0001', 'p1', 'Zé Barbeiro', 's1', 'Corte Navalhado', 'Concluído', 'Pago', 'Painel',
        'Sim', 'Sim', 'Barbearia', 'Motivo X', 'Observação do agendamento', '30/09/2026 10:00',
      ]);
      expect(celulas(2, 1)).toEqual([
        'CMD-1A2B3', '1a2b3c4d-0000-4000-8000-000000000001', '01/10/2026 19:40', '01/10/2026 20:20', 'Fechada', 'c1', 'João da Conceição', 'a1',
        '2x Corte Navalhado (35,25) - Zé Barbeiro', '5,00', '10', '3,25', 'p1', 'Zé Barbeiro', '70,50', 'Dinheiro em espécie 80,00 (troco 9,50)', 'Observação da comanda',
      ]);
      expect(arquivos[0].conteudo).not.toContain('token');
    });
  });
});
