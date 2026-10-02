import { dateInZone, formatTimeInZone } from '../../lib/timezone';
import { PAYMENT_METHOD_LABELS } from '../caixa/types';
import { gerarCsvEmBlocos, type CsvColumn } from '../relatorios/csv';
import { formatDisplayDate, formatOrigemLabel, formatRegistrationOriginLabel } from '../relatorios/formatacao';
import { cpfParaPlanilha, telefoneParaPlanilha } from './planilha';
import type {
  AgendamentoParaExportar,
  ArquivoCsv,
  ClienteParaExportar,
  ComandaParaExportar,
  DetalhesDaExportacao,
  IExportacaoAdapter,
  ItemDeComandaParaExportar,
  OpcoesDaExportacao,
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
const AUTORIA_DO_CANCELAMENTO: Record<string, string> = { shop: 'Barbearia', customer: 'Cliente' };
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

const ordemAlfabetica = new Intl.Collator('pt-BR');
const porId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Do mais antigo ao mais novo, lendo o instante de cada linha uma vez só (e não duas por comparação). */
function ordenarPorInstante<T>(linhas: T[], instante: (linha: T) => string): T[] {
  return linhas
    .map((linha) => ({ linha, quando: Date.parse(instante(linha)) }))
    .sort((a, b) => a.quando - b.quando)
    .map(({ linha }) => linha);
}

const SEM_NOME = 'Item sem nome';
/** Serviço antes de produto: é a ordem em que a comanda nasce (o serviço do agendamento) e em que a tela a mostra. */
const ORDEM_DO_TIPO_DE_ITEM: Record<string, number> = { servico: 0, produto: 1 };

/**
 * Exportação de Dados (spec 052, ticket 14): monta os três CSV (clientes, agendamentos e comandas) da barbearia, no formato dos
 * relatórios (`;`, BOM do UTF-8, CRLF, valor que começaria uma fórmula protegido). Quem chama baixa os arquivos. Cliente,
 * profissional e serviço dos agendamentos e das comandas aparecem pelo ID e pelo nome, lado a lado, para os arquivos poderem ser
 * cruzados mesmo com dois clientes de mesmo nome; os itens da comanda vão pelo nome, resumidos na célula "Itens".
 */
export class ExportacaoRepository {
  private readonly adapter: IExportacaoAdapter;

  constructor(adapter: IExportacaoAdapter) {
    this.adapter = adapter;
  }

  /**
   * `fuso` é o da barbearia: o dia e a hora do arquivo são os que o Gerente vê na tela. Se uma leitura falha, as outras param de
   * ler (e o `sinal` de quem pediu, ao ser cancelado, faz o mesmo): ninguém fica paginando tabelas para um arquivo que não sai.
   */
  async gerarArquivos(tenantId: string, fuso: string, { agora = new Date(), sinal }: OpcoesDaExportacao = {}): Promise<ArquivoCsv[]> {
    if (!tenantId) throw new ExportacaoError('Não foi possível identificar a barbearia para exportar os dados.');
    if (sinal?.aborted) throw new ExportacaoError('A exportação foi cancelada.');

    const cancelamento = new AbortController();
    const cancelar = () => cancelamento.abort();
    sinal?.addEventListener('abort', cancelar, { once: true });
    const leitura = { sinal: cancelamento.signal };

    try {
      const [clientes, agendamentos, comandas, itens, pagamentos, profissionais, servicos, produtos] = await Promise.all([
        this.adapter.listarClientes(tenantId, leitura),
        this.adapter.listarAgendamentos(tenantId, leitura),
        this.adapter.listarComandas(tenantId, leitura),
        this.adapter.listarItensDeComandas(tenantId, leitura),
        this.adapter.listarPagamentosDeComandas(tenantId, leitura),
        this.adapter.listarProfissionais(tenantId, leitura),
        this.adapter.listarServicos(tenantId, leitura),
        this.adapter.listarProdutos(tenantId, leitura),
      ]);

      const nomes = (linhas: { id: string; name: string }[]) => new Map(linhas.map((linha) => [linha.id, linha.name]));
      const clientePorId = new Map(clientes.map((cliente) => [cliente.id, cliente]));
      const profissionalPorId = nomes(profissionais);
      const servicoPorId = nomes(servicos);
      const produtoPorId = nomes(produtos);
      const itensDaComanda = agrupar(itens, (item) => item.comanda_id);
      const pagamentosDaComanda = agrupar(pagamentos, (pagamento) => pagamento.comanda_id);
      const dia = dateInZone(agora, fuso);

      const cliente = (id: string | null) => (id ? clientePorId.get(id) : undefined);
      const nomeDoProfissional = (id: string | null) => (id ? (profissionalPorId.get(id) ?? '') : '');

      const colunasDeClientes: CsvColumn<ClienteParaExportar>[] = [
        { header: 'ID', accessor: (c) => c.id },
        { header: 'Nome', accessor: (c) => c.name },
        { header: 'Telefone', accessor: (c) => telefoneParaPlanilha(c.phone) },
        { header: 'E-mail', accessor: (c) => texto(c.email) },
        { header: 'CPF', accessor: (c) => cpfParaPlanilha(c.cpf) },
        { header: 'Data de nascimento', accessor: (c) => (c.birth_date ? formatDisplayDate(c.birth_date) : '') },
        { header: 'Etiquetas', accessor: (c) => c.tags.join(', ') },
        { header: 'Canal de aquisição', accessor: (c) => texto(c.acquisition_channel) },
        { header: 'Origem do cadastro', accessor: (c) => formatRegistrationOriginLabel(c.registration_origin) },
        { header: 'Cadastro completo', accessor: (c) => simOuNao(c.cadastro_completo) },
        { header: 'Observações', accessor: (c) => texto(c.notes) },
        { header: 'Cadastrado em', accessor: (c) => dataHoraNoFuso(c.created_at, fuso) },
      ];

      const colunasDeAgendamentos: CsvColumn<AgendamentoParaExportar>[] = [
        { header: 'ID', accessor: (a) => a.id },
        { header: 'Data', accessor: (a) => dataNoFuso(a.start_time, fuso) },
        { header: 'Início', accessor: (a) => formatTimeInZone(a.start_time, fuso) },
        { header: 'Fim', accessor: (a) => formatTimeInZone(a.end_time, fuso) },
        { header: 'ID do cliente', accessor: (a) => texto(a.customer_id) },
        { header: 'Cliente', accessor: (a) => cliente(a.customer_id)?.name ?? '' },
        { header: 'Telefone do cliente', accessor: (a) => telefoneParaPlanilha(cliente(a.customer_id)?.phone ?? null) },
        { header: 'ID do profissional', accessor: (a) => a.professional_id },
        { header: 'Profissional', accessor: (a) => nomeDoProfissional(a.professional_id) },
        { header: 'ID do serviço', accessor: (a) => a.service_id },
        { header: 'Serviço', accessor: (a) => servicoPorId.get(a.service_id) ?? '' },
        { header: 'Situação', accessor: (a) => rotulo(SITUACAO_DO_AGENDAMENTO, a.status) },
        { header: 'Pagamento', accessor: (a) => rotulo(PAGAMENTO_DO_AGENDAMENTO, a.payment_status) },
        { header: 'Origem', accessor: (a) => formatOrigemLabel(a.origin) },
        { header: 'Encaixe', accessor: (a) => simOuNao(a.is_fitting) },
        { header: 'Veio da lista de espera', accessor: (a) => simOuNao(a.from_waiting_list) },
        { header: 'Cancelado por', accessor: (a) => rotulo(AUTORIA_DO_CANCELAMENTO, a.canceled_by) },
        { header: 'Motivo do cancelamento', accessor: (a) => texto(a.cancellation_reason) },
        { header: 'Observações', accessor: (a) => texto(a.notes) },
        { header: 'Criado em', accessor: (a) => dataHoraNoFuso(a.created_at, fuso) },
      ];

      const nomeDoItem = (item: ItemDeComandaParaExportar) =>
        (item.service_id ? servicoPorId.get(item.service_id) : undefined) ??
        (item.product_id ? produtoPorId.get(item.product_id) : undefined) ??
        SEM_NOME;
      // Os itens e os pagamentos chegam do banco em ordem de ID, que é aleatória: o arquivo os põe em ordem fixa.
      const itensEmOrdem = (comandaId: string) =>
        [...(itensDaComanda.get(comandaId) ?? [])].sort(
          (a, b) =>
            (ORDEM_DO_TIPO_DE_ITEM[a.item_type] ?? 2) - (ORDEM_DO_TIPO_DE_ITEM[b.item_type] ?? 2) ||
            ordemAlfabetica.compare(nomeDoItem(a), nomeDoItem(b)) ||
            porId(a, b),
        );
      const pagamentosEmOrdem = (comandaId: string) =>
        [...(pagamentosDaComanda.get(comandaId) ?? [])].sort((a, b) => Date.parse(a.paid_at) - Date.parse(b.paid_at) || porId(a, b));

      const descreverItem = (item: ItemDeComandaParaExportar) => {
        const profissional = nomeDoProfissional(item.professional_id);
        return `${item.quantity}x ${nomeDoItem(item)} (${dinheiro(item.unit_price)})${profissional ? ` - ${profissional}` : ''}`;
      };
      const descreverPagamento = (pagamento: PagamentoDeComandaParaExportar) => {
        const forma = rotulo(PAYMENT_METHOD_LABELS, pagamento.payment_method);
        const troco = pagamento.change_amount > 0 ? ` (troco ${dinheiro(pagamento.change_amount)})` : '';
        return `${forma} ${dinheiro(pagamento.amount)}${troco}`;
      };

      const colunasDeComandas: CsvColumn<ComandaParaExportar>[] = [
        { header: 'Código', accessor: (c) => `CMD-${c.id.slice(0, 5).toUpperCase()}` },
        { header: 'ID', accessor: (c) => c.id },
        { header: 'Abertura', accessor: (c) => dataHoraNoFuso(c.created_at, fuso) },
        { header: 'Fechamento', accessor: (c) => dataHoraNoFuso(c.closed_at, fuso) },
        { header: 'Situação', accessor: (c) => rotulo(SITUACAO_DA_COMANDA, c.status) },
        { header: 'ID do cliente', accessor: (c) => texto(c.customer_id) },
        { header: 'Cliente', accessor: (c) => cliente(c.customer_id)?.name ?? '' },
        { header: 'ID do agendamento', accessor: (c) => texto(c.appointment_id) },
        { header: 'Itens', accessor: (c) => itensEmOrdem(c.id).map(descreverItem).join(' | ') },
        { header: 'Desconto', accessor: (c) => dinheiro(c.discount_amount) },
        { header: 'Desconto em %', accessor: (c) => (c.discount_type === 'percent' ? numero(c.discount_percent) : '') },
        { header: 'Gorjeta', accessor: (c) => dinheiro(c.tip_amount) },
        { header: 'ID do profissional da gorjeta', accessor: (c) => texto(c.tip_professional_id) },
        { header: 'Profissional da gorjeta', accessor: (c) => nomeDoProfissional(c.tip_professional_id) },
        { header: 'Total', accessor: (c) => dinheiro(c.total_amount) },
        { header: 'Pagamentos', accessor: (c) => pagamentosEmOrdem(c.id).map(descreverPagamento).join(' | ') },
        { header: 'Observações', accessor: (c) => texto(c.notes) },
      ];

      const arquivos: ArquivoCsv[] = [
        {
          nome: `clientes_${dia}.csv`,
          conteudo: await gerarCsvEmBlocos(colunasDeClientes, [...clientes].sort((a, b) => ordemAlfabetica.compare(a.name, b.name)), leitura),
        },
        {
          nome: `agendamentos_${dia}.csv`,
          conteudo: await gerarCsvEmBlocos(colunasDeAgendamentos, ordenarPorInstante(agendamentos, (a) => a.start_time), leitura),
        },
        {
          nome: `comandas_${dia}.csv`,
          conteudo: await gerarCsvEmBlocos(colunasDeComandas, ordenarPorInstante(comandas, (c) => c.created_at), leitura),
        },
      ];

      await this.registrar({
        arquivos: arquivos.length,
        linhas: { clientes: clientes.length, agendamentos: agendamentos.length, comandas: comandas.length },
      });
      return arquivos;
    } catch (erro) {
      cancelamento.abort();
      throw erro;
    } finally {
      sinal?.removeEventListener('abort', cancelar);
    }
  }

  /** Deixa o rastro da exportação na trilha de auditoria; uma falha aqui não tira do Gerente os dados dele. */
  private async registrar(detalhes: DetalhesDaExportacao): Promise<void> {
    try {
      await this.adapter.registrarExportacao(detalhes);
    } catch (erro) {
      console.error('Não foi possível registrar a exportação na trilha de auditoria:', erro);
    }
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
