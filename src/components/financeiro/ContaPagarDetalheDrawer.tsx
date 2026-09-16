import React, { useCallback, useEffect, useState } from 'react';
import { Drawer } from '../ui/feedback/Drawer';
import { Badge } from '../ui/data-display/Badge';
import { Button } from '../ui/forms/Button';
import { Skeleton } from '../ui/data-display/Skeleton';
import { EmptyState } from '../ui/data-display/EmptyState';
import { BaixaDialog } from './BaixaDialog';
import { EstornoBaixaDialog } from './EstornoBaixaDialog';
import { EditarContaDialog } from './EditarContaDialog';
import { CancelarContaDialog } from './CancelarContaDialog';
import { EstenderSerieDialog } from './EstenderSerieDialog';
import { ContasPagarRepository } from '../../modules/contas-pagar/ContasPagarRepository';
import type { CaixaRepository } from '../../modules/caixa/CaixaRepository';
import type {
  Baixa,
  ContaPagarDetalhe,
  FormaPagamentoBaixa,
  PeriodicidadeSerie,
  TipoSerie,
} from '../../modules/contas-pagar/types';
import type { CategoriaDespesa, Fornecedor } from '../../modules/plano-contas/types';

export interface ContaPagarDetalheDrawerProps {
  isOpen: boolean;
  repository: ContasPagarRepository;
  /** Repositório de Caixa (ticket 15/036): detecta a sessão aberta para a Baixa oferecer a origem gaveta. */
  caixaRepository: CaixaRepository;
  tenantId: string;
  payableId: string;
  categoriasAtivas: CategoriaDespesa[];
  fornecedoresAtivos: Fornecedor[];
  onClose: () => void;
  /** Chamado depois de qualquer Baixa, estorno, edição ou cancelamento, para a lista por trás recarregar. */
  onAtualizado: () => void;
}

const ROTULO_SITUACAO: Record<string, { label: string; variant: 'neutral' | 'success' | 'warning' | 'error' }> = {
  open: { label: 'Em aberto', variant: 'neutral' },
  partially_paid: { label: 'Parcialmente paga', variant: 'warning' },
  paid: { label: 'Paga', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'neutral' },
  overdue: { label: 'Vencida', variant: 'error' },
};

const ROTULO_FORMA: Record<FormaPagamentoBaixa, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  transfer: 'Transferência',
  boleto: 'Boleto',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  automatic_debit: 'Débito automático',
  other: 'Outra',
};

const ROTULO_TIPO_SERIE: Record<TipoSerie, string> = {
  recurring: 'Recorrência',
  installment: 'Parcelamento',
};

const ROTULO_PERIODICIDADE: Record<PeriodicidadeSerie, string> = {
  weekly: 'semanal',
  biweekly: 'quinzenal',
  monthly: 'mensal',
  yearly: 'anual',
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Detalhe de uma Conta a Pagar (ticket 07/036): a conta, suas Baixas com
 * autor e trilha de estorno. A trilha de cancelamento e o resumo da Série
 * entram nos tickets 08 e 11 — os campos já existem no contrato de leitura,
 * mas esta versão ainda não os exibe.
 */
export const ContaPagarDetalheDrawer: React.FC<ContaPagarDetalheDrawerProps> = ({
  isOpen,
  repository,
  caixaRepository,
  tenantId,
  payableId,
  categoriasAtivas,
  fornecedoresAtivos,
  onClose,
  onAtualizado,
}) => {
  const [conta, setConta] = useState<ContaPagarDetalhe | null>(null);
  const [baixas, setBaixas] = useState<Baixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baixaDialogAberto, setBaixaDialogAberto] = useState(false);
  const [estornoAlvo, setEstornoAlvo] = useState<Baixa | null>(null);
  const [editarAberto, setEditarAberto] = useState(false);
  const [cancelarAberto, setCancelarAberto] = useState(false);
  const [estenderAberto, setEstenderAberto] = useState(false);

  const carregar = useCallback(async () => {
    if (!isOpen || !payableId) return;
    setLoading(true);
    setError(null);
    try {
      const [contaCarregada, baixasCarregadas] = await Promise.all([
        repository.obterConta(tenantId, payableId),
        repository.listarBaixas(tenantId, payableId),
      ]);
      setConta(contaCarregada);
      setBaixas(baixasCarregadas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a conta.');
    } finally {
      setLoading(false);
    }
  }, [isOpen, payableId, tenantId, repository]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleBaixaSalva = async () => {
    setBaixaDialogAberto(false);
    await carregar();
    onAtualizado();
  };

  const handleEstornoConcluido = async () => {
    setEstornoAlvo(null);
    await carregar();
    onAtualizado();
  };

  const handleEdicaoSalva = async () => {
    setEditarAberto(false);
    await carregar();
    onAtualizado();
  };

  const handleCancelamentoConcluido = async () => {
    setCancelarAberto(false);
    await carregar();
    onAtualizado();
  };

  const handleExtensaoConcluida = async () => {
    setEstenderAberto(false);
    await carregar();
    onAtualizado();
  };

  const situacao = conta ? ROTULO_SITUACAO[conta.situation] || ROTULO_SITUACAO.open : null;
  const podeReceberBaixa = conta ? conta.status === 'open' || conta.status === 'partially_paid' : false;
  const podeEditar = conta ? conta.status !== 'cancelled' : false;
  const podeCancelar = conta ? conta.status === 'open' : false;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Detalhe da conta a pagar" width="min(92vw, 560px)">
      {loading && (
        <div className="conta-pagar-detalhe-skeleton">
          <Skeleton height={24} />
          <Skeleton height={80} />
          <Skeleton height={120} />
        </div>
      )}

      {!loading && error && (
        <EmptyState title="Não foi possível carregar a conta" description={error} />
      )}

      {!loading && !error && conta && (
        <div className="conta-pagar-detalhe">
          <header className="conta-pagar-detalhe-header">
            <h3 className="conta-pagar-detalhe-titulo">{conta.description}</h3>
            {situacao && <Badge variant={situacao.variant}>{situacao.label}</Badge>}
          </header>

          <dl className="conta-pagar-detalhe-info">
            <div>
              <dt>Categoria</dt>
              <dd>{conta.category_name}</dd>
            </div>
            {conta.supplier_name && (
              <div>
                <dt>Fornecedor</dt>
                <dd>{conta.supplier_name}</dd>
              </div>
            )}
            <div>
              <dt>Vencimento</dt>
              <dd>{formatarData(conta.due_date)}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{formatarMoeda(conta.amount)}</dd>
            </div>
            {conta.seriesType && (
              <div>
                <dt>Série</dt>
                <dd>
                  {ROTULO_TIPO_SERIE[conta.seriesType]}
                  {conta.seriesPeriodicity && ` ${ROTULO_PERIODICIDADE[conta.seriesPeriodicity]}`}
                  {conta.series_position && conta.seriesOccurrencesCount
                    ? ` · ${conta.series_position}/${conta.seriesOccurrencesCount}`
                    : ''}
                </dd>
              </div>
            )}
            <div>
              <dt>Saldo restante</dt>
              <dd>{formatarMoeda(conta.remaining_amount)}</dd>
            </div>
            {conta.document_number && (
              <div>
                <dt>Documento</dt>
                <dd>{conta.document_number}</dd>
              </div>
            )}
            {conta.notes && (
              <div>
                <dt>Observação</dt>
                <dd>{conta.notes}</dd>
              </div>
            )}
            {conta.createdByName && (
              <div>
                <dt>Lançada por</dt>
                <dd>{conta.createdByName}</dd>
              </div>
            )}
            {conta.status === 'cancelled' && conta.cancelledAt && (
              <div>
                <dt>Cancelada</dt>
                <dd>
                  {formatarData(conta.cancelledAt.slice(0, 10))}
                  {conta.cancelledByName && ` por ${conta.cancelledByName}`}
                  {conta.cancellationReason && `: ${conta.cancellationReason}`}
                </dd>
              </div>
            )}
          </dl>

          {conta.seriesEndingSoon && conta.series_id && (
            <div className="conta-pagar-detalhe-aviso-serie" role="status">
              <p>
                Esta Recorrência está perto de acabar
                {conta.seriesLastDueDate && ` — última ocorrência vence em ${formatarData(conta.seriesLastDueDate)}`}
                .
              </p>
              <Button variant="secondary" size="sm" onClick={() => setEstenderAberto(true)}>
                Estender Série
              </Button>
            </div>
          )}

          <div className="conta-pagar-detalhe-acoes">
            {podeReceberBaixa && (
              <Button variant="primary" size="sm" onClick={() => setBaixaDialogAberto(true)}>
                Dar Baixa
              </Button>
            )}
            {podeEditar && (
              <Button variant="secondary" size="sm" onClick={() => setEditarAberto(true)}>
                Editar
              </Button>
            )}
            {podeCancelar && (
              <Button variant="secondary" size="sm" onClick={() => setCancelarAberto(true)}>
                Cancelar conta
              </Button>
            )}
          </div>

          <h4 className="conta-pagar-detalhe-subtitulo">Baixas</h4>

          {baixas.length === 0 && (
            <p className="conta-pagar-detalhe-vazio">Nenhuma Baixa lançada ainda.</p>
          )}

          {baixas.length > 0 && (
            <ul className="conta-pagar-detalhe-baixas">
              {baixas.map((baixa) => (
                <li key={baixa.id} className="conta-pagar-detalhe-baixa">
                  <div className="conta-pagar-detalhe-baixa-linha">
                    <span className="conta-pagar-detalhe-baixa-valor">
                      {formatarMoeda(baixa.paidAmount)}
                    </span>
                    {baixa.reversedAt ? (
                      <Badge variant="neutral">Estornada</Badge>
                    ) : (
                      <Badge variant="success">Ativa</Badge>
                    )}
                  </div>
                  <p className="conta-pagar-detalhe-baixa-detalhe">
                    Principal {formatarMoeda(baixa.principal)}
                    {baixa.interestAmount > 0 && ` · Juros ${formatarMoeda(baixa.interestAmount)}`}
                    {baixa.discountAmount > 0 && ` · Desconto ${formatarMoeda(baixa.discountAmount)}`}
                  </p>
                  <p className="conta-pagar-detalhe-baixa-detalhe">
                    {formatarData(baixa.paymentDate)} · {ROTULO_FORMA[baixa.paymentMethod]}
                    {baixa.createdByName && ` · lançada por ${baixa.createdByName}`}
                  </p>
                  {baixa.reversedAt && (
                    <p className="conta-pagar-detalhe-baixa-detalhe">
                      Estornada{baixa.reversedByName && ` por ${baixa.reversedByName}`}
                      {baixa.reversalReason && `: ${baixa.reversalReason}`}
                    </p>
                  )}
                  {!baixa.reversedAt && (
                    <Button variant="secondary" size="sm" onClick={() => setEstornoAlvo(baixa)}>
                      Estornar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {conta && (
        <BaixaDialog
          isOpen={baixaDialogAberto}
          repository={repository}
          caixaRepository={caixaRepository}
          tenantId={tenantId}
          payableId={payableId}
          saldoRestante={conta.remaining_amount}
          onSalvar={handleBaixaSalva}
          onCancelar={() => setBaixaDialogAberto(false)}
        />
      )}

      {estornoAlvo && (
        <EstornoBaixaDialog
          isOpen={!!estornoAlvo}
          repository={repository}
          tenantId={tenantId}
          settlementId={estornoAlvo.id}
          onEstornado={handleEstornoConcluido}
          onCancelar={() => setEstornoAlvo(null)}
        />
      )}

      {conta && (
        <EditarContaDialog
          isOpen={editarAberto}
          repository={repository}
          tenantId={tenantId}
          conta={conta}
          categoriasAtivas={categoriasAtivas}
          fornecedoresAtivos={fornecedoresAtivos}
          onSalvar={handleEdicaoSalva}
          onSerieEditada={handleEdicaoSalva}
          onCancelar={() => setEditarAberto(false)}
        />
      )}

      <CancelarContaDialog
        isOpen={cancelarAberto}
        repository={repository}
        tenantId={tenantId}
        payableId={payableId}
        pertenceASerie={!!conta?.seriesType}
        onCancelado={handleCancelamentoConcluido}
        onSerieCancelada={handleCancelamentoConcluido}
        onFechar={() => setCancelarAberto(false)}
      />

      {conta?.series_id && (
        <EstenderSerieDialog
          isOpen={estenderAberto}
          repository={repository}
          tenantId={tenantId}
          seriesId={conta.series_id}
          onEstendida={handleExtensaoConcluida}
          onFechar={() => setEstenderAberto(false)}
        />
      )}

      <style>{`
        .conta-pagar-detalhe-skeleton {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .conta-pagar-detalhe {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .conta-pagar-detalhe-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .conta-pagar-detalhe-titulo {
          margin: 0;
          font-size: 1rem;
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
        }

        .conta-pagar-detalhe-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem 1rem;
          margin: 0;
        }

        .conta-pagar-detalhe-info dt {
          font-size: var(--font-size-xs, 0.75rem);
          color: var(--color-text-secondary, #70625B);
        }

        .conta-pagar-detalhe-info dd {
          margin: 0;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
        }

        .conta-pagar-detalhe-aviso-serie {
          background-color: var(--color-brand-lightest, #FFF1E6);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-md, 8px);
          padding: 0.85rem;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .conta-pagar-detalhe-aviso-serie p {
          margin: 0;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-primary, #2D231E);
        }

        .conta-pagar-detalhe-acoes {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .conta-pagar-detalhe-subtitulo {
          margin: 0.5rem 0 0;
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
        }

        .conta-pagar-detalhe-vazio {
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-secondary, #70625B);
        }

        .conta-pagar-detalhe-baixas {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .conta-pagar-detalhe-baixa {
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-md, 8px);
          padding: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .conta-pagar-detalhe-baixa-linha {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .conta-pagar-detalhe-baixa-valor {
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
        }

        .conta-pagar-detalhe-baixa-detalhe {
          margin: 0;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-secondary, #70625B);
        }
      `}</style>
    </Drawer>
  );
};
