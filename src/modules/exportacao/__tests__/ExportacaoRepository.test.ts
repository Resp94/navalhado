import { describe, expect, it, vi } from 'vitest';
import { ExportacaoRepository, ExportacaoError } from '../ExportacaoRepository';
import { InMemoryExportacaoAdapter, type DadosEmMemoria } from '../adapters/InMemoryExportacaoAdapter';
import type { IExportacaoAdapter, OpcoesDeLeitura } from '../types';

const TENANT = 'tenant-a';
const OUTRO_TENANT = 'tenant-b';
// Manaus fica 4 horas atrás de UTC e não muda de horário: separa o dia, a hora e a data do arquivo do que seria UTC.
const FUSO = 'America/Manaus';
// 02:30 UTC de 02/10 ainda é 01/10 (22:30) em Manaus.
const AGORA = new Date('2026-10-02T02:30:00Z');
const OPCOES = { agora: AGORA };

const BOM = '﻿';
const linhasDe = (csv: string) => csv.replace(BOM, '').split('\r\n');
const linha = (...celulas: string[]) => celulas.join(';');

const COMANDA_1 = '1a2b3c4d-0000-4000-8000-000000000001';
const COMANDA_2 = '9f8e7d6c-0000-4000-8000-000000000002';

type Cliente = NonNullable<DadosEmMemoria['clientes']>[number];
type Agendamento = NonNullable<DadosEmMemoria['agendamentos']>[number];
type Comanda = NonNullable<DadosEmMemoria['comandas']>[number];
type Item = NonNullable<DadosEmMemoria['itens']>[number];
type Pagamento = NonNullable<DadosEmMemoria['pagamentos']>[number];

const cliente = (extra: Partial<Cliente>): Cliente => ({
  tenant_id: TENANT,
  id: 'c0',
  name: 'Cliente',
  phone: null,
  email: null,
  cpf: null,
  birth_date: null,
  tags: [],
  acquisition_channel: null,
  registration_origin: 'balcao',
  cadastro_completo: true,
  notes: null,
  created_at: '2026-01-01T12:00:00Z',
  ...extra,
});

const agendamento = (extra: Partial<Agendamento>): Agendamento => ({
  tenant_id: TENANT,
  id: 'a0',
  customer_id: null,
  professional_id: 'p1',
  service_id: 's1',
  start_time: '2026-10-01T12:00:00Z',
  end_time: '2026-10-01T12:45:00Z',
  status: 'confirmed',
  payment_status: 'pending',
  origin: 'manual',
  is_fitting: false,
  from_waiting_list: false,
  canceled_by: null,
  cancellation_reason: null,
  notes: null,
  created_at: '2026-09-30T12:00:00Z',
  ...extra,
});

const comanda = (extra: Partial<Comanda>): Comanda => ({
  tenant_id: TENANT,
  id: COMANDA_1,
  appointment_id: null,
  customer_id: null,
  status: 'fechada',
  total_amount: 0,
  discount_amount: 0,
  discount_type: 'amount',
  discount_percent: null,
  tip_amount: 0,
  tip_professional_id: null,
  notes: null,
  created_at: '2026-10-01T12:00:00Z',
  closed_at: null,
  ...extra,
});

const item = (extra: Partial<Item>): Item => ({
  tenant_id: TENANT,
  id: 'i0',
  comanda_id: COMANDA_1,
  item_type: 'servico',
  service_id: 's1',
  product_id: null,
  professional_id: null,
  quantity: 1,
  unit_price: 40,
  ...extra,
});

const pagamento = (extra: Partial<Pagamento>): Pagamento => ({
  tenant_id: TENANT,
  id: 'pg0',
  comanda_id: COMANDA_1,
  payment_method: 'pix',
  amount: 50,
  change_amount: 0,
  paid_at: '2026-10-02T00:20:00Z',
  ...extra,
});

function dados(): DadosEmMemoria {
  return {
    clientes: [
      cliente({
        id: 'c1',
        name: 'João da Conceição',
        phone: '92999990001',
        email: 'joao@exemplo.com',
        cpf: '123.456.789-09',
        birth_date: '1990-03-05',
        tags: ['VIP', 'Barba'],
        acquisition_channel: 'Instagram',
        registration_origin: 'whatsapp_bot',
        notes: 'Prefere "degradê"; horário à tarde',
        created_at: '2026-01-10T15:30:00Z',
        // O token de acesso é credencial: mesmo se a linha o trouxesse, o arquivo não o leva.
        ...({ token_acesso: 'token-secreto-do-cliente' } as object),
      }),
      cliente({ id: 'c2', name: 'Ana Maria', registration_origin: 'balcao', cadastro_completo: false, created_at: '2026-01-02T03:00:00Z' }),
      cliente({
        id: 'c3',
        name: 'Carlos Souza',
        phone: '+5592999990003',
        cpf: '01234567890',
        registration_origin: 'agenda',
        notes: '=1+1',
        created_at: '2026-02-01T12:00:00Z',
      }),
      cliente({ id: 'c4', name: 'Bia Online', phone: '92999990004', registration_origin: 'online', created_at: '2026-03-03T15:00:00Z' }),
      cliente({ tenant_id: OUTRO_TENANT, id: 'cx', name: 'Cliente de Outra Barbearia', phone: '92000000000' }),
    ],
    profissionais: [
      { tenant_id: TENANT, id: 'p1', name: 'Zé Barbeiro' },
      { tenant_id: OUTRO_TENANT, id: 'px', name: 'Profissional de Outra Barbearia' },
    ],
    servicos: [
      { tenant_id: TENANT, id: 's1', name: 'Corte Navalhado' },
      { tenant_id: OUTRO_TENANT, id: 'sx', name: 'Serviço de Outra Barbearia' },
    ],
    produtos: [{ tenant_id: TENANT, id: 'pr1', name: 'Pomada Modeladora' }],
    agendamentos: [
      agendamento({
        id: 'a1',
        customer_id: 'c1',
        start_time: '2026-10-01T23:30:00Z',
        end_time: '2026-10-02T00:15:00Z',
        status: 'completed',
        payment_status: 'paid',
        origin: 'manual',
        created_at: '2026-09-30T14:00:00Z',
      }),
      agendamento({
        id: 'a2',
        customer_id: 'c2',
        start_time: '2026-10-02T13:00:00Z',
        end_time: '2026-10-02T13:45:00Z',
        status: 'canceled',
        origin: 'client_channel',
        is_fitting: true,
        from_waiting_list: true,
        canceled_by: 'customer',
        cancellation_reason: 'Imprevisto; volto depois',
        notes: 'Encaixe',
        created_at: '2026-10-01T12:00:00Z',
      }),
      agendamento({
        id: 'a3',
        customer_id: null,
        start_time: '2026-09-15T12:00:00Z',
        end_time: '2026-09-15T12:45:00Z',
        status: 'no_show',
        origin: 'whatsapp',
        canceled_by: 'shop',
        created_at: '2026-09-10T12:00:00Z',
      }),
      agendamento({
        id: 'a4',
        customer_id: 'c3',
        start_time: '2026-10-04T12:00:00Z',
        end_time: '2026-10-04T12:45:00Z',
        origin: 'online',
        created_at: '2026-10-03T12:00:00Z',
      }),
      agendamento({ tenant_id: OUTRO_TENANT, id: 'ax', customer_id: 'cx', professional_id: 'px', service_id: 'sx' }),
    ],
    comandas: [
      comanda({
        id: COMANDA_2,
        status: 'cancelada',
        discount_type: 'percent',
        discount_percent: 10,
        notes: 'Linha 1\nLinha 2',
        created_at: '2026-10-03T12:00:00Z',
      }),
      comanda({
        id: COMANDA_1,
        appointment_id: 'a1',
        customer_id: 'c1',
        total_amount: 70,
        discount_amount: 5,
        tip_amount: 5,
        tip_professional_id: 'p1',
        created_at: '2026-10-01T23:40:00Z',
        closed_at: '2026-10-02T00:20:00Z',
      }),
      comanda({ tenant_id: OUTRO_TENANT, id: 'cmx', customer_id: 'cx', total_amount: 99 }),
    ],
    // Os itens e os pagamentos chegam do banco em ordem de ID (aleatória): o arquivo os põe em ordem fixa.
    itens: [
      item({ id: 'i1', item_type: 'produto', service_id: null, product_id: 'pr1', unit_price: 30 }),
      item({ id: 'i2', item_type: 'servico', service_id: 's1', professional_id: 'p1', unit_price: 40 }),
      item({ id: 'i3', comanda_id: COMANDA_2, service_id: 'servico-removido', quantity: 2, unit_price: 12.5 }),
    ],
    pagamentos: [
      pagamento({ id: 'pg1', payment_method: 'cash', amount: 20, change_amount: 5, paid_at: '2026-10-02T00:20:00Z' }),
      pagamento({ id: 'pg2', payment_method: 'pix', amount: 50, paid_at: '2026-10-02T00:19:00Z' }),
    ],
  };
}

describe('ExportacaoRepository', () => {
  const repositorio = (conteudo: DadosEmMemoria = dados()) => new ExportacaoRepository(new InMemoryExportacaoAdapter(conteudo));

  it('gera três CSV, com o dia do arquivo no fuso da barbearia', async () => {
    const arquivos = await repositorio().gerarArquivos(TENANT, FUSO, OPCOES);

    expect(arquivos.map((arquivo) => arquivo.nome)).toEqual([
      'clientes_2026-10-01.csv',
      'agendamentos_2026-10-01.csv',
      'comandas_2026-10-01.csv',
    ]);
  });

  it('todo arquivo começa com o BOM do UTF-8 (o Excel abre os acentos certos) e separa por ponto e vírgula', async () => {
    const arquivos = await repositorio().gerarArquivos(TENANT, FUSO, OPCOES);

    for (const arquivo of arquivos) {
      expect(arquivo.conteudo.startsWith(BOM)).toBe(true);
      expect(linhasDe(arquivo.conteudo)[0]).toContain(';');
    }
  });

  describe('clientes', () => {
    it('traz os clientes em ordem alfabética, com o cabeçalho e os acentos certos, e telefone e CPF que a planilha guarda como texto', async () => {
      const [clientes] = await repositorio().gerarArquivos(TENANT, FUSO, OPCOES);

      expect(linhasDe(clientes.conteudo)).toEqual([
        linha('ID', 'Nome', 'Telefone', 'E-mail', 'CPF', 'Data de nascimento', 'Etiquetas', 'Canal de aquisição', 'Origem do cadastro', 'Cadastro completo', 'Observações', 'Cadastrado em'),
        linha('c2', 'Ana Maria', '', '', '', '', '', '', 'Balcão', 'Não', '', '01/01/2026 23:00'),
        linha('c4', 'Bia Online', '(92) 99999-0004', '', '', '', '', '', 'Link público', 'Sim', '', '03/03/2026 11:00'),
        linha('c3', 'Carlos Souza', '55 (92) 99999-0003', '', '012.345.678-90', '', '', '', 'Agenda', 'Sim', "'=1+1", '01/02/2026 08:00'),
        linha(
          'c1', 'João da Conceição', '(92) 99999-0001', 'joao@exemplo.com', '123.456.789-09', '05/03/1990', 'VIP, Barba', 'Instagram', 'WhatsApp', 'Sim',
          '"Prefere ""degradê""; horário à tarde"', '10/01/2026 11:30',
        ),
      ]);
    });

    it('não leva o token de acesso do cliente, nem se a linha lido do banco o trouxesse', async () => {
      const [clientes] = await repositorio().gerarArquivos(TENANT, FUSO, OPCOES);

      expect(clientes.conteudo).not.toContain('token-secreto-do-cliente');
      expect(clientes.conteudo.toLowerCase()).not.toContain('token');
    });
  });

  describe('agendamentos', () => {
    it('traz os agendamentos do mais antigo ao mais novo, com cliente, profissional e serviço pelo ID e pelo nome, e o horário no fuso da barbearia', async () => {
      const [, agendamentos] = await repositorio().gerarArquivos(TENANT, FUSO, OPCOES);

      expect(linhasDe(agendamentos.conteudo)).toEqual([
        linha(
          'ID', 'Data', 'Início', 'Fim', 'ID do cliente', 'Cliente', 'Telefone do cliente', 'ID do profissional', 'Profissional', 'ID do serviço', 'Serviço',
          'Situação', 'Pagamento', 'Origem', 'Encaixe', 'Veio da lista de espera', 'Cancelado por', 'Motivo do cancelamento', 'Observações', 'Criado em',
        ),
        linha(
          'a3', '15/09/2026', '08:00', '08:45', '', '', '', 'p1', 'Zé Barbeiro', 's1', 'Corte Navalhado', 'Não compareceu', 'Pendente', 'WhatsApp', 'Não', 'Não',
          'Barbearia', '', '', '10/09/2026 08:00',
        ),
        linha(
          'a1', '01/10/2026', '19:30', '20:15', 'c1', 'João da Conceição', '(92) 99999-0001', 'p1', 'Zé Barbeiro', 's1', 'Corte Navalhado', 'Concluído', 'Pago',
          'Painel', 'Não', 'Não', '', '', '', '30/09/2026 10:00',
        ),
        linha(
          'a2', '02/10/2026', '09:00', '09:45', 'c2', 'Ana Maria', '', 'p1', 'Zé Barbeiro', 's1', 'Corte Navalhado', 'Cancelado', 'Pendente', 'Canal do Cliente',
          'Sim', 'Sim', 'Cliente', '"Imprevisto; volto depois"', 'Encaixe', '01/10/2026 08:00',
        ),
        linha(
          'a4', '04/10/2026', '08:00', '08:45', 'c3', 'Carlos Souza', '55 (92) 99999-0003', 'p1', 'Zé Barbeiro', 's1', 'Corte Navalhado', 'Confirmado', 'Pendente',
          'Link público', 'Não', 'Não', '', '', '', '03/10/2026 08:00',
        ),
      ]);
    });

    it('dois clientes com o mesmo nome se distinguem pelo ID do cliente', async () => {
      const [, agendamentos] = await repositorio({
        clientes: [cliente({ id: 'joao-1', name: 'João Silva' }), cliente({ id: 'joao-2', name: 'João Silva' })],
        agendamentos: [
          agendamento({ id: 'a1', customer_id: 'joao-1', start_time: '2026-10-01T12:00:00Z' }),
          agendamento({ id: 'a2', customer_id: 'joao-2', start_time: '2026-10-02T12:00:00Z' }),
        ],
      }).gerarArquivos(TENANT, FUSO, OPCOES);

      const [, primeiro, segundo] = linhasDe(agendamentos.conteudo).map((celulas) => celulas.split(';'));
      expect([primeiro[4], primeiro[5]]).toEqual(['joao-1', 'João Silva']);
      expect([segundo[4], segundo[5]]).toEqual(['joao-2', 'João Silva']);
    });

    it('ordena lendo o instante de cada agendamento uma vez só, e não duas por comparação', async () => {
      const quantos = 500;
      const muitos = Array.from({ length: quantos }, (_, indice) =>
        agendamento({ id: `a${indice}`, start_time: new Date(Date.UTC(2026, 0, 1) + ((indice * 7919) % quantos) * 60_000).toISOString() }),
      );
      const parse = vi.spyOn(Date, 'parse');

      try {
        const [, agendamentos] = await repositorio({ agendamentos: muitos }).gerarArquivos(TENANT, FUSO, OPCOES);

        // Reler a data a cada comparação custaria perto de 9 mil leituras para 500 linhas.
        expect(parse.mock.calls.length).toBeLessThan(1000);
        expect(linhasDe(agendamentos.conteudo)).toHaveLength(quantos + 1);
      } finally {
        parse.mockRestore();
      }
    });

    it('o mesmo agendamento com a mesma hora de início mantém a ordem em que chegou', async () => {
      const [, agendamentos] = await repositorio({
        agendamentos: [
          agendamento({ id: 'primeiro', start_time: '2026-10-01T12:00:00Z' }),
          agendamento({ id: 'segundo', start_time: '2026-10-01T12:00:00Z' }),
          agendamento({ id: 'anterior', start_time: '2026-09-30T12:00:00Z' }),
        ],
      }).gerarArquivos(TENANT, FUSO, OPCOES);

      expect(linhasDe(agendamentos.conteudo).slice(1).map((celulas) => celulas.split(';')[0])).toEqual(['anterior', 'primeiro', 'segundo']);
    });
  });

  describe('comandas', () => {
    it('traz as comandas da mais antiga à mais nova, com cliente pelo ID e pelo nome, itens com o profissional, gorjeta com o profissional e pagamentos em ordem', async () => {
      const [, , comandas] = await repositorio().gerarArquivos(TENANT, FUSO, OPCOES);

      expect(linhasDe(comandas.conteudo)).toEqual([
        linha(
          'Código', 'ID', 'Abertura', 'Fechamento', 'Situação', 'ID do cliente', 'Cliente', 'ID do agendamento', 'Itens', 'Desconto', 'Desconto em %', 'Gorjeta',
          'ID do profissional da gorjeta', 'Profissional da gorjeta', 'Total', 'Pagamentos', 'Observações',
        ),
        linha(
          'CMD-1A2B3', COMANDA_1, '01/10/2026 19:40', '01/10/2026 20:20', 'Fechada', 'c1', 'João da Conceição', 'a1',
          '1x Corte Navalhado (40,00) - Zé Barbeiro | 1x Pomada Modeladora (30,00)', '5,00', '', '5,00', 'p1', 'Zé Barbeiro', '70,00',
          'PIX 50,00 | Dinheiro em espécie 20,00 (troco 5,00)', '',
        ),
        linha(
          'CMD-9F8E7', COMANDA_2, '03/10/2026 08:00', '', 'Cancelada', '', '', '', '2x Item sem nome (12,50)', '0,00', '10', '0,00', '', '', '0,00', '',
          '"Linha 1\nLinha 2"',
        ),
      ]);
    });

    it('os itens saem com o serviço antes do produto, e dentro de cada um por nome e por ID, qualquer que seja a ordem em que chegam', async () => {
      const itens = [
        item({ id: 'i9', item_type: 'produto', service_id: null, product_id: 'pr1' }),
        item({ id: 'i8', item_type: 'servico', service_id: 's2' }),
        item({ id: 'i7', item_type: 'servico', service_id: 's1' }),
        item({ id: 'i6', item_type: 'servico', service_id: 's1' }),
      ];
      const base = {
        servicos: [
          { tenant_id: TENANT, id: 's1', name: 'Corte' },
          { tenant_id: TENANT, id: 's2', name: 'Barba' },
        ],
        // O produto vem antes dos serviços na ordem alfabética: só a regra "serviço antes de produto" o põe por último.
        produtos: [{ tenant_id: TENANT, id: 'pr1', name: 'Anti-queda' }],
        comandas: [comanda({})],
      };

      const celulaDeItens = async (ordemDeChegada: Item[]) => {
        const [, , comandas] = await repositorio({ ...base, itens: ordemDeChegada }).gerarArquivos(TENANT, FUSO, OPCOES);
        return linhasDe(comandas.conteudo)[1].split(';')[8];
      };

      const esperado = '1x Barba (40,00) | 1x Corte (40,00) | 1x Corte (40,00) | 1x Anti-queda (40,00)';
      expect(await celulaDeItens(itens)).toBe(esperado);
      expect(await celulaDeItens([...itens].reverse())).toBe(esperado);
      expect(await celulaDeItens([itens[2], itens[0], itens[3], itens[1]])).toBe(esperado);
    });

    it('os pagamentos saem na ordem em que foram feitos; no mesmo instante, por ID', async () => {
      const [, , comandas] = await repositorio({
        comandas: [comanda({})],
        pagamentos: [
          pagamento({ id: 'z', payment_method: 'debit_card', amount: 10, paid_at: '2026-10-02T00:30:00Z' }),
          pagamento({ id: 'b', payment_method: 'pix', amount: 20, paid_at: '2026-10-02T00:10:00Z' }),
          pagamento({ id: 'a', payment_method: 'cash', amount: 30, paid_at: '2026-10-02T00:10:00Z' }),
        ],
      }).gerarArquivos(TENANT, FUSO, OPCOES);

      expect(linhasDe(comandas.conteudo)[1].split(';')[15]).toBe('Dinheiro em espécie 30,00 | PIX 20,00 | Cartão de débito 10,00');
    });
  });

  it('uma barbearia sem dados recebe os três arquivos só com o cabeçalho', async () => {
    const arquivos = await repositorio().gerarArquivos('tenant-vazio', FUSO, OPCOES);

    expect(arquivos).toHaveLength(3);
    for (const arquivo of arquivos) {
      expect(linhasDe(arquivo.conteudo)).toHaveLength(1);
    }
  });

  it('recusa quando não sabe de qual barbearia exportar', async () => {
    await expect(repositorio().gerarArquivos('', FUSO, OPCOES)).rejects.toThrow(ExportacaoError);
  });

  // O filtro por barbearia é do banco (a RLS e o `eq('tenant_id')`, provados no teste do adaptador Supabase e no pgTAP 76); o que
  // é do repositório é pedir cada leitura para a barbearia certa.
  it('pede as oito leituras para a barbearia da exportação, e só para ela', async () => {
    const adaptador = new InMemoryExportacaoAdapter(dados());
    const leituras = {
      listarClientes: vi.spyOn(adaptador, 'listarClientes'),
      listarAgendamentos: vi.spyOn(adaptador, 'listarAgendamentos'),
      listarComandas: vi.spyOn(adaptador, 'listarComandas'),
      listarItensDeComandas: vi.spyOn(adaptador, 'listarItensDeComandas'),
      listarPagamentosDeComandas: vi.spyOn(adaptador, 'listarPagamentosDeComandas'),
      listarProfissionais: vi.spyOn(adaptador, 'listarProfissionais'),
      listarServicos: vi.spyOn(adaptador, 'listarServicos'),
      listarProdutos: vi.spyOn(adaptador, 'listarProdutos'),
    };

    await new ExportacaoRepository(adaptador).gerarArquivos(TENANT, FUSO, OPCOES);

    for (const [nome, leitura] of Object.entries(leituras)) {
      expect(leitura, nome).toHaveBeenCalledTimes(1);
      expect(leitura.mock.calls[0][0], nome).toBe(TENANT);
    }
  });

  describe('trilha de auditoria', () => {
    it('registra uma vez, depois de montar os arquivos, quantos arquivos e quantas linhas saíram, sem dado de cliente', async () => {
      const adaptador = new InMemoryExportacaoAdapter(dados());

      await new ExportacaoRepository(adaptador).gerarArquivos(TENANT, FUSO, OPCOES);

      expect(adaptador.registros).toEqual([{ arquivos: 3, linhas: { clientes: 4, agendamentos: 4, comandas: 2 } }]);
    });

    it('uma falha ao registrar não impede o Gerente de levar os arquivos', async () => {
      const adaptador = new InMemoryExportacaoAdapter(dados());
      vi.spyOn(adaptador, 'registrarExportacao').mockRejectedValue(new Error('audit_logs fora do ar'));
      const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

      const arquivos = await new ExportacaoRepository(adaptador).gerarArquivos(TENANT, FUSO, OPCOES);

      expect(arquivos).toHaveLength(3);
      expect(erro).toHaveBeenCalled();
      erro.mockRestore();
    });

    it('não registra uma exportação que falhou', async () => {
      const adaptador = new InMemoryExportacaoAdapter(dados());
      vi.spyOn(adaptador, 'listarComandas').mockRejectedValue(new Error('o banco falhou'));

      await expect(new ExportacaoRepository(adaptador).gerarArquivos(TENANT, FUSO, OPCOES)).rejects.toThrow('o banco falhou');

      expect(adaptador.registros).toEqual([]);
    });
  });

  describe('cancelamento', () => {
    const sinaisDe = (adaptador: IExportacaoAdapter) => {
      const sinais: AbortSignal[] = [];
      for (const nome of [
        'listarClientes',
        'listarAgendamentos',
        'listarComandas',
        'listarItensDeComandas',
        'listarPagamentosDeComandas',
        'listarProfissionais',
        'listarServicos',
        'listarProdutos',
      ] as const) {
        const original = adaptador[nome].bind(adaptador) as (tenantId: string, opcoes?: OpcoesDeLeitura) => Promise<unknown>;
        vi.spyOn(adaptador, nome).mockImplementation((tenantId: string, opcoes?: OpcoesDeLeitura) => {
          if (opcoes?.sinal) sinais.push(opcoes.sinal);
          return original(tenantId, opcoes) as never;
        });
      }
      return sinais;
    };

    it('cada leitura recebe o sinal, e uma que falha cancela as outras', async () => {
      const adaptador = new InMemoryExportacaoAdapter(dados());
      const sinais = sinaisDe(adaptador);
      vi.spyOn(adaptador, 'listarComandas').mockRejectedValue(new Error('o banco falhou'));

      await expect(new ExportacaoRepository(adaptador).gerarArquivos(TENANT, FUSO, OPCOES)).rejects.toThrow('o banco falhou');

      expect(sinais).toHaveLength(7);
      expect(sinais.every((sinal) => sinal.aborted)).toBe(true);
    });

    it('uma exportação que dá certo não cancela nada', async () => {
      const adaptador = new InMemoryExportacaoAdapter(dados());
      const sinais = sinaisDe(adaptador);

      await new ExportacaoRepository(adaptador).gerarArquivos(TENANT, FUSO, OPCOES);

      expect(sinais).toHaveLength(8);
      expect(sinais.some((sinal) => sinal.aborted)).toBe(false);
    });

    it('o sinal de quem pediu chega às leituras: quem sai da tela cancela a exportação', async () => {
      const adaptador = new InMemoryExportacaoAdapter(dados());
      let sinalDaLeitura: AbortSignal | undefined;
      // Uma leitura lenta, que (como o fetch de verdade) falha quando o sinal é cancelado.
      vi.spyOn(adaptador, 'listarClientes').mockImplementation(
        (_tenantId: string, opcoes?: OpcoesDeLeitura) =>
          new Promise((_resolve, rejeitar) => {
            sinalDaLeitura = opcoes?.sinal;
            opcoes?.sinal?.addEventListener('abort', () => rejeitar(new Error('leitura cancelada')));
          }),
      );
      const saiuDaTela = new AbortController();

      const exportacao = new ExportacaoRepository(adaptador).gerarArquivos(TENANT, FUSO, { ...OPCOES, sinal: saiuDaTela.signal });
      saiuDaTela.abort();

      await expect(exportacao).rejects.toThrow('leitura cancelada');
      expect(sinalDaLeitura?.aborted).toBe(true);
    });

    it('um sinal já cancelado nem começa a ler', async () => {
      const adaptador = new InMemoryExportacaoAdapter(dados());
      const leitura = vi.spyOn(adaptador, 'listarClientes');
      const cancelado = new AbortController();
      cancelado.abort();

      await expect(new ExportacaoRepository(adaptador).gerarArquivos(TENANT, FUSO, { ...OPCOES, sinal: cancelado.signal })).rejects.toThrow();

      expect(leitura).not.toHaveBeenCalled();
    });
  });
});
