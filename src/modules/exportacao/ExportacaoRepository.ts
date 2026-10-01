import { dateInZone, formatTimeInZone } from '../../lib/timezone';
import { PAYMENT_METHOD_LABELS } from '../caixa/types';
import { formatDisplayDate } from '../relatorios/formatacao';
import { gerarCsv, type CsvColumn } from '../relatorios/csv';
import type {
  AgendamentoParaExportar,
  ArquivoCsv,
  ClienteParaExportar,
  ComandaParaExportar,
  IExportacaoAdapter,
  ItemDeComandaParaExportar,
  PagamentoDeComandaParaExportar,
} from './types';

export class ExportacaoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportacaoError';
  }
}

const SITUACAO_DO_AGENDAMENTO: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  in_progress: 'Em atendimento',
  completed: 'Concluído',
  canceled: 'Cancelado',
  no_show: 'Não compareceu',
};
const PAGAMENTO_DO_AGENDAMENTO: Record<string, string> = { pending: 'Pendente', paid: 'Pago' };
const ORIGEM_DO_AGENDAMENTO: Record<string, string> = {
  manual: 'Manual',
  whatsapp: 'WhatsApp',
  client_channel: 'Canal do Cliente',
  online: 'Online',
};
const QUEM_CANCELOU: Record<string, string> = { shop: 'Barbearia', customer: 'Cliente' };
const ORIGEM_DO_CADASTRO: Record<string, string> = {
  balcao: 'Balcão',
  agenda: 'Agenda',
  online: 'Online',
  importacao: 'Importação',
  canal_cliente: 'Canal do Cliente',
  whatsapp_bot: 'WhatsApp',
};
const SITUACAO_DA_COMANDA: Record<string, string> = { aberta: 'Aberta', fechada: 'Fechada', cancelada: 'Cancelada' };

/** O valor que o banco guarda tem rótulo em português; um valor novo que ainda não tem passa como está, em vez de sumir. */
const rotulo = (rotulos: Record<string, string>, valor: string | null) => (valor === null ? '' : (rotulos[valor] ?? valor));
const simOuNao = (valor: boolean) => (valor ? 'Sim' : 'Não');
const dinheiro = (valor: number) => Number(valor).toFixed(2).replace('.', ',');
const numero = (valor: number | null) => (valor === null ? '' : String(valor).replace('.', ','));
const texto = (valor: string | null) => valor ?? '';

const dataNoFuso = (instante: string, fuso: string) => formatDisplayDate(dateInZone(new Date(instante), fuso));
const dataHoraNoFuso = (instante: string | null, fuso: string) =>
  instante === null ? '' : `${dataNoFuso(instante, fuso)} ${formatTimeInZone(instante, fuso)}`;

const porInstante = (a: string, b: string) => Date.parse(a) - Date.parse(b);

const SEM_NOME = 'Item sem nome';

/**
 * Exportação de Dados (spec 052, ticket 14): monta os três CSV (clientes, agendamentos e comandas) da barbearia, no formato dos
 * relatórios (`;`, BOM do UTF-8, CRLF, valor que começaria uma fórmula protegido). Quem chama baixa os arquivos. Cliente,
 * profissional, serviço e produto aparecem pelo nome, com o identificador ao lado para o arquivo poder ser cruzado.
 */
export class ExportacaoRepository {
  private readonly adapter: IExportacaoAdapter;

  constructor(adapter: IExportacaoAdapter) {
    this.adapter = adapter;
  }

  /** `fuso` é o da barbearia: o dia e a hora do arquivo são os que o Gerente vê na tela. */
  async gerarArquivos(tenantId: string, fuso: string, agora: Date = new Date()): Promise<ArquivoCsv[]> {
    if (!tenantId) throw new ExportacaoError('Não foi possível identificar a barbearia para exportar os dados.');

    const [clientes, agendamentos, comandas, itens, pagamentos, profissionais, servicos, produtos] = await Promise.all([
      this.adapter.listarClientes(tenantId),
      this.adapter.listarAgendamentos(tenantId),
      this.adapter.listarComandas(tenantId),
      this.adapter.listarItensDeComandas(tenantId),
      this.adapter.listarPagamentosDeComandas(tenantId),
      this.adapter.listarProfissionais(tenantId),
      this.adapter.listarServicos(tenantId),
      this.adapter.listarProdutos(tenantId),
    ]);

    const nomes = (linhas: { id: string; name: string }[]) => new Map(linhas.map((linha) => [linha.id, linha.name]));
    const clientePorId = new Map(clientes.map((cliente) => [cliente.id, cliente]));
    const profissionalPorId = nomes(profissionais);
    const servicoPorId = nomes(servicos);
    const produtoPorId = nomes(produtos);
    const itensDaComanda = agrupar(itens, (item) => item.comanda_id);
    const pagamentosDaComanda = agrupar(pagamentos, (pagamento) => pagamento.comanda_id);
    const dia = dateInZone(agora, fuso);

    const colunasDeClientes: CsvColumn<ClienteParaExportar>[] = [
      { header: 'ID', accessor: (c) => c.id },
      { header: 'Nome', accessor: (c) => c.name },
      { header: 'Telefone', accessor: (c) => texto(c.phone) },
      { header: 'E-mail', accessor: (c) => texto(c.email) },
      { header: 'CPF', accessor: (c) => texto(c.cpf) },
      { header: 'Data de nascimento', accessor: (c) => (c.birth_date ? formatDisplayDate(c.birth_date) : '') },
      { header: 'Etiquetas', accessor: (c) => c.tags.join(', ') },
      { header: 'Canal de aquisição', accessor: (c) => texto(c.acquisition_channel) },
      { header: 'Origem do cadastro', accessor: (c) => rotulo(ORIGEM_DO_CADASTRO, c.registration_origin) },
      { header: 'Cadastro completo', accessor: (c) => simOuNao(c.cadastro_completo) },
      { header: 'Observações', accessor: (c) => texto(c.notes) },
      { header: 'Cadastrado em', accessor: (c) => dataHoraNoFuso(c.created_at, fuso) },
    ];

    const colunasDeAgendamentos: CsvColumn<AgendamentoParaExportar>[] = [
      { header: 'ID', accessor: (a) => a.id },
      { header: 'Data', accessor: (a) => dataNoFuso(a.start_time, fuso) },
      { header: 'Início', accessor: (a) => formatTimeInZone(a.start_time, fuso) },
      { header: 'Fim', accessor: (a) => formatTimeInZone(a.end_time, fuso) },
      { header: 'Cliente', accessor: (a) => (a.customer_id ? texto(clientePorId.get(a.customer_id)?.name ?? null) : '') },
      { header: 'Telefone do cliente', accessor: (a) => (a.customer_id ? texto(clientePorId.get(a.customer_id)?.phone ?? null) : '') },
      { header: 'Profissional', accessor: (a) => profissionalPorId.get(a.professional_id) ?? '' },
      { header: 'Serviço', accessor: (a) => servicoPorId.get(a.service_id) ?? '' },
      { header: 'Situação', accessor: (a) => rotulo(SITUACAO_DO_AGENDAMENTO, a.status) },
      { header: 'Pagamento', accessor: (a) => rotulo(PAGAMENTO_DO_AGENDAMENTO, a.payment_status) },
      { header: 'Origem', accessor: (a) => rotulo(ORIGEM_DO_AGENDAMENTO, a.origin) },
      { header: 'Encaixe', accessor: (a) => simOuNao(a.is_fitting) },
      { header: 'Veio da lista de espera', accessor: (a) => simOuNao(a.from_waiting_list) },
      { header: 'Cancelado por', accessor: (a) => rotulo(QUEM_CANCELOU, a.canceled_by) },
      { header: 'Motivo do cancelamento', accessor: (a) => texto(a.cancellation_reason) },
      { header: 'Observações', accessor: (a) => texto(a.notes) },
      { header: 'Criado em', accessor: (a) => dataHoraNoFuso(a.created_at, fuso) },
    ];

    const descreverItem = (item: ItemDeComandaParaExportar) => {
      const nome = (item.service_id ? servicoPorId.get(item.service_id) : undefined) ?? (item.product_id ? produtoPorId.get(item.product_id) : undefined);
      return `${item.quantity}x ${nome ?? SEM_NOME} (${dinheiro(item.unit_price)})`;
    };
    const descreverPagamento = (pagamento: PagamentoDeComandaParaExportar) => {
      const forma = PAYMENT_METHOD_LABELS[pagamento.payment_method] ?? pagamento.payment_method;
      const troco = pagamento.change_amount > 0 ? ` (troco ${dinheiro(pagamento.change_amount)})` : '';
      return `${forma} ${dinheiro(pagamento.amount)}${troco}`;
    };

    const colunasDeComandas: CsvColumn<ComandaParaExportar>[] = [
      { header: 'Código', accessor: (c) => `CMD-${c.id.slice(0, 5).toUpperCase()}` },
      { header: 'ID', accessor: (c) => c.id },
      { header: 'Abertura', accessor: (c) => dataHoraNoFuso(c.created_at, fuso) },
      { header: 'Fechamento', accessor: (c) => dataHoraNoFuso(c.closed_at, fuso) },
      { header: 'Situação', accessor: (c) => rotulo(SITUACAO_DA_COMANDA, c.status) },
      { header: 'Cliente', accessor: (c) => (c.customer_id ? texto(clientePorId.get(c.customer_id)?.name ?? null) : '') },
      { header: 'ID do agendamento', accessor: (c) => texto(c.appointment_id) },
      { header: 'Itens', accessor: (c) => (itensDaComanda.get(c.id) ?? []).map(descreverItem).join(' | ') },
      { header: 'Desconto', accessor: (c) => dinheiro(c.discount_amount) },
      { header: 'Desconto em %', accessor: (c) => (c.discount_type === 'percent' ? numero(c.discount_percent) : '') },
      { header: 'Gorjeta', accessor: (c) => dinheiro(c.tip_amount) },
      { header: 'Total', accessor: (c) => dinheiro(c.total_amount) },
      { header: 'Pagamentos', accessor: (c) => (pagamentosDaComanda.get(c.id) ?? []).map(descreverPagamento).join(' | ') },
      { header: 'Observações', accessor: (c) => texto(c.notes) },
    ];

    return [
      {
        nome: `clientes_${dia}.csv`,
        conteudo: gerarCsv(colunasDeClientes, [...clientes].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))),
      },
      {
        nome: `agendamentos_${dia}.csv`,
        conteudo: gerarCsv(colunasDeAgendamentos, [...agendamentos].sort((a, b) => porInstante(a.start_time, b.start_time))),
      },
      {
        nome: `comandas_${dia}.csv`,
        conteudo: gerarCsv(colunasDeComandas, [...comandas].sort((a, b) => porInstante(a.created_at, b.created_at))),
      },
    ];
  }
}

function agrupar<T>(linhas: T[], chave: (linha: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const linha of linhas) {
    const grupo = grupos.get(chave(linha));
    if (grupo) grupo.push(linha);
    else grupos.set(chave(linha), [linha]);
  }
  return grupos;
}
