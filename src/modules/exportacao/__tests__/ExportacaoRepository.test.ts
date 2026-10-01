import { describe, expect, it } from 'vitest';
import { ExportacaoRepository, ExportacaoError } from '../ExportacaoRepository';
import { InMemoryExportacaoAdapter, type DadosEmMemoria } from '../adapters/InMemoryExportacaoAdapter';

const TENANT = 'tenant-a';
const OUTRO_TENANT = 'tenant-b';
// Manaus fica 4 horas atrás de UTC e não muda de horário: separa o dia, a hora e a data do arquivo do que seria UTC.
const FUSO = 'America/Manaus';
// 02:30 UTC de 02/10 ainda é 01/10 (22:30) em Manaus.
const AGORA = new Date('2026-10-02T02:30:00Z');

const BOM = '﻿';
const linhasDe = (csv: string) => csv.replace(BOM, '').split('\r\n');
const linha = (...celulas: string[]) => celulas.join(';');

const COMANDA_1 = '1a2b3c4d-0000-4000-8000-000000000001';
const COMANDA_2 = '9f8e7d6c-0000-4000-8000-000000000002';

function dados(): DadosEmMemoria {
  return {
    clientes: [
      {
        tenant_id: TENANT,
        id: 'c1',
        name: 'João da Conceição',
        phone: '92999990001',
        email: 'joao@exemplo.com',
        cpf: '123.456.789-09',
        birth_date: '1990-03-05',
        tags: ['VIP', 'Barba'],
        acquisition_channel: 'Instagram',
        registration_origin: 'whatsapp_bot',
        cadastro_completo: true,
        notes: 'Prefere "degradê"; horário à tarde',
        created_at: '2026-01-10T15:30:00Z',
      },
      {
        tenant_id: TENANT,
        id: 'c2',
        name: 'Ana Maria',
        phone: null,
        email: null,
        cpf: null,
        birth_date: null,
        tags: [],
        acquisition_channel: null,
        registration_origin: 'balcao',
        cadastro_completo: false,
        notes: null,
        created_at: '2026-01-02T03:00:00Z',
      },
      {
        tenant_id: TENANT,
        id: 'c3',
        name: 'Carlos Souza',
        phone: '92999990003',
        email: null,
        cpf: null,
        birth_date: null,
        tags: [],
        acquisition_channel: null,
        registration_origin: 'agenda',
        cadastro_completo: true,
        notes: '=1+1',
        created_at: '2026-02-01T12:00:00Z',
      },
      {
        tenant_id: OUTRO_TENANT,
        id: 'cx',
        name: 'Cliente de Outra Barbearia',
        phone: '92000000000',
        email: null,
        cpf: null,
        birth_date: null,
        tags: [],
        acquisition_channel: null,
        registration_origin: 'balcao',
        cadastro_completo: true,
        notes: null,
        created_at: '2026-01-01T00:00:00Z',
      },
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
      {
        tenant_id: TENANT,
        id: 'a1',
        customer_id: 'c1',
        professional_id: 'p1',
        service_id: 's1',
        start_time: '2026-10-01T23:30:00Z',
        end_time: '2026-10-02T00:15:00Z',
        status: 'completed',
        payment_status: 'paid',
        origin: 'manual',
        is_fitting: false,
        from_waiting_list: false,
        canceled_by: null,
        cancellation_reason: null,
        notes: null,
        created_at: '2026-09-30T14:00:00Z',
      },
      {
        tenant_id: TENANT,
        id: 'a2',
        customer_id: 'c2',
        professional_id: 'p1',
        service_id: 's1',
        start_time: '2026-10-02T13:00:00Z',
        end_time: '2026-10-02T13:45:00Z',
        status: 'canceled',
        payment_status: 'pending',
        origin: 'client_channel',
        is_fitting: true,
        from_waiting_list: true,
        canceled_by: 'customer',
        cancellation_reason: 'Imprevisto; volto depois',
        notes: 'Encaixe',
        created_at: '2026-10-01T12:00:00Z',
      },
      {
        tenant_id: TENANT,
        id: 'a3',
        customer_id: null,
        professional_id: 'p1',
        service_id: 's1',
        start_time: '2026-09-15T12:00:00Z',
        end_time: '2026-09-15T12:45:00Z',
        status: 'no_show',
        payment_status: 'pending',
        origin: 'whatsapp',
        is_fitting: false,
        from_waiting_list: false,
        canceled_by: 'shop',
        cancellation_reason: null,
        notes: null,
        created_at: '2026-09-10T12:00:00Z',
      },
      {
        tenant_id: OUTRO_TENANT,
        id: 'ax',
        customer_id: 'cx',
        professional_id: 'px',
        service_id: 'sx',
        start_time: '2026-10-01T12:00:00Z',
        end_time: '2026-10-01T12:45:00Z',
        status: 'completed',
        payment_status: 'paid',
        origin: 'manual',
        is_fitting: false,
        from_waiting_list: false,
        canceled_by: null,
        cancellation_reason: null,
        notes: null,
        created_at: '2026-09-30T12:00:00Z',
      },
    ],
    comandas: [
      {
        tenant_id: TENANT,
        id: COMANDA_2,
        appointment_id: null,
        customer_id: null,
        status: 'cancelada',
        total_amount: 0,
        discount_amount: 0,
        discount_type: 'percent',
        discount_percent: 10,
        tip_amount: 0,
        notes: 'Linha 1\nLinha 2',
        created_at: '2026-10-03T12:00:00Z',
        closed_at: null,
      },
      {
        tenant_id: TENANT,
        id: COMANDA_1,
        appointment_id: 'a1',
        customer_id: 'c1',
        status: 'fechada',
        total_amount: 70,
        discount_amount: 5,
        discount_type: 'amount',
        discount_percent: null,
        tip_amount: 5,
        notes: null,
        created_at: '2026-10-01T23:40:00Z',
        closed_at: '2026-10-02T00:20:00Z',
      },
      {
        tenant_id: OUTRO_TENANT,
        id: 'cmx',
        appointment_id: null,
        customer_id: 'cx',
        status: 'fechada',
        total_amount: 99,
        discount_amount: 0,
        discount_type: 'amount',
        discount_percent: null,
        tip_amount: 0,
        notes: null,
        created_at: '2026-10-01T10:00:00Z',
        closed_at: null,
      },
    ],
    itens: [
      { tenant_id: TENANT, comanda_id: COMANDA_1, item_type: 'servico', service_id: 's1', product_id: null, quantity: 1, unit_price: 40, total_price: 40 },
      { tenant_id: TENANT, comanda_id: COMANDA_1, item_type: 'produto', service_id: null, product_id: 'pr1', quantity: 1, unit_price: 30, total_price: 30 },
      { tenant_id: TENANT, comanda_id: COMANDA_2, item_type: 'servico', service_id: 'servico-removido', product_id: null, quantity: 2, unit_price: 12.5, total_price: 25 },
    ],
    pagamentos: [
      { tenant_id: TENANT, comanda_id: COMANDA_1, payment_method: 'pix', amount: 50, change_amount: 0, paid_at: '2026-10-02T00:20:00Z' },
      { tenant_id: TENANT, comanda_id: COMANDA_1, payment_method: 'cash', amount: 20, change_amount: 5, paid_at: '2026-10-02T00:20:00Z' },
    ],
  };
}

describe('ExportacaoRepository', () => {
  const repositorio = (conteudo: DadosEmMemoria = dados()) => new ExportacaoRepository(new InMemoryExportacaoAdapter(conteudo));

  it('gera três CSV, com o dia do arquivo no fuso da barbearia', async () => {
    const arquivos = await repositorio().gerarArquivos(TENANT, FUSO, AGORA);

    expect(arquivos.map((arquivo) => arquivo.nome)).toEqual([
      'clientes_2026-10-01.csv',
      'agendamentos_2026-10-01.csv',
      'comandas_2026-10-01.csv',
    ]);
  });

  it('todo arquivo começa com o BOM do UTF-8 (o Excel abre os acentos certos) e separa por ponto e vírgula', async () => {
    const arquivos = await repositorio().gerarArquivos(TENANT, FUSO, AGORA);

    for (const arquivo of arquivos) {
      expect(arquivo.conteudo.startsWith(BOM)).toBe(true);
      expect(linhasDe(arquivo.conteudo)[0]).toContain(';');
    }
  });

  describe('clientes', () => {
    it('traz só os clientes da barbearia, em ordem alfabética, com o cabeçalho e os acentos certos', async () => {
      const [clientes] = await repositorio().gerarArquivos(TENANT, FUSO, AGORA);

      expect(linhasDe(clientes.conteudo)).toEqual([
        linha('ID', 'Nome', 'Telefone', 'E-mail', 'CPF', 'Data de nascimento', 'Etiquetas', 'Canal de aquisição', 'Origem do cadastro', 'Cadastro completo', 'Observações', 'Cadastrado em'),
        linha('c2', 'Ana Maria', '', '', '', '', '', '', 'Balcão', 'Não', '', '01/01/2026 23:00'),
        linha('c3', 'Carlos Souza', '92999990003', '', '', '', '', '', 'Agenda', 'Sim', "'=1+1", '01/02/2026 08:00'),
        linha(
          'c1', 'João da Conceição', '92999990001', 'joao@exemplo.com', '123.456.789-09', '05/03/1990', 'VIP, Barba', 'Instagram', 'WhatsApp', 'Sim',
          '"Prefere ""degradê""; horário à tarde"', '10/01/2026 11:30',
        ),
      ]);
    });

    it('não leva o token de acesso do cliente nem o cliente de outra barbearia', async () => {
      const [clientes] = await repositorio().gerarArquivos(TENANT, FUSO, AGORA);

      expect(clientes.conteudo).not.toContain('Outra Barbearia');
      expect(clientes.conteudo.toLowerCase()).not.toContain('token');
    });
  });

  describe('agendamentos', () => {
    it('traz só os agendamentos da barbearia, do mais antigo ao mais novo, com cliente, profissional e serviço por nome e o horário no fuso da barbearia', async () => {
      const [, agendamentos] = await repositorio().gerarArquivos(TENANT, FUSO, AGORA);

      expect(linhasDe(agendamentos.conteudo)).toEqual([
        linha(
          'ID', 'Data', 'Início', 'Fim', 'Cliente', 'Telefone do cliente', 'Profissional', 'Serviço', 'Situação', 'Pagamento', 'Origem', 'Encaixe',
          'Veio da lista de espera', 'Cancelado por', 'Motivo do cancelamento', 'Observações', 'Criado em',
        ),
        linha('a3', '15/09/2026', '08:00', '08:45', '', '', 'Zé Barbeiro', 'Corte Navalhado', 'Não compareceu', 'Pendente', 'WhatsApp', 'Não', 'Não', 'Barbearia', '', '', '10/09/2026 08:00'),
        linha('a1', '01/10/2026', '19:30', '20:15', 'João da Conceição', '92999990001', 'Zé Barbeiro', 'Corte Navalhado', 'Concluído', 'Pago', 'Manual', 'Não', 'Não', '', '', '', '30/09/2026 10:00'),
        linha(
          'a2', '02/10/2026', '09:00', '09:45', 'Ana Maria', '', 'Zé Barbeiro', 'Corte Navalhado', 'Cancelado', 'Pendente', 'Canal do Cliente', 'Sim', 'Sim', 'Cliente',
          '"Imprevisto; volto depois"', 'Encaixe', '01/10/2026 08:00',
        ),
      ]);
    });

    it('não leva o agendamento nem os nomes de outra barbearia', async () => {
      const [, agendamentos] = await repositorio().gerarArquivos(TENANT, FUSO, AGORA);

      expect(agendamentos.conteudo).not.toContain('Outra Barbearia');
      expect(agendamentos.conteudo).not.toContain('ax;');
    });
  });

  describe('comandas', () => {
    it('traz só as comandas da barbearia, da mais antiga à mais nova, com itens e pagamentos em uma linha', async () => {
      const [, , comandas] = await repositorio().gerarArquivos(TENANT, FUSO, AGORA);

      expect(linhasDe(comandas.conteudo)).toEqual([
        linha(
          'Código', 'ID', 'Abertura', 'Fechamento', 'Situação', 'Cliente', 'ID do agendamento', 'Itens', 'Desconto', 'Desconto em %', 'Gorjeta', 'Total', 'Pagamentos', 'Observações',
        ),
        linha(
          'CMD-1A2B3', COMANDA_1, '01/10/2026 19:40', '01/10/2026 20:20', 'Fechada', 'João da Conceição', 'a1', '1x Corte Navalhado (40,00) | 1x Pomada Modeladora (30,00)',
          '5,00', '', '5,00', '70,00', 'PIX 50,00 | Dinheiro em espécie 20,00 (troco 5,00)', '',
        ),
        linha(
          'CMD-9F8E7', COMANDA_2, '03/10/2026 08:00', '', 'Cancelada', '', '', '2x Item sem nome (12,50)', '0,00', '10', '0,00', '0,00', '', '"Linha 1\nLinha 2"',
        ),
      ]);
    });

    it('não leva a comanda de outra barbearia', async () => {
      const [, , comandas] = await repositorio().gerarArquivos(TENANT, FUSO, AGORA);

      expect(comandas.conteudo).not.toContain('cmx');
      expect(comandas.conteudo).not.toContain('99,00');
    });
  });

  it('uma barbearia sem dados recebe os três arquivos só com o cabeçalho', async () => {
    const arquivos = await repositorio().gerarArquivos('tenant-vazio', FUSO, AGORA);

    expect(arquivos).toHaveLength(3);
    for (const arquivo of arquivos) {
      expect(linhasDe(arquivo.conteudo)).toHaveLength(1);
    }
  });

  it('recusa quando não sabe de qual barbearia exportar', async () => {
    await expect(repositorio().gerarArquivos('', FUSO, AGORA)).rejects.toThrow(ExportacaoError);
  });
});
