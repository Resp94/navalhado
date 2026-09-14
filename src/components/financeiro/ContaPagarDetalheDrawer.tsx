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
import { ContasPagarRepository } from '../../modules/contas-pagar/ContasPagarRepository';
import type { Baixa, ContaPagarDetalhe, FormaPagamentoBaixa } from '../../modules/contas-pagar/types';
import type { CategoriaDespesa, Fornecedor } from '../../modules/plano-contas/types';

export interface ContaPagarDetalheDrawerProps {
  isOpen: boolean;
  repository: ContasPagarRepository;
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
          onCancelar={() => setEditarAberto(false)}
        />
      )}

      <CancelarContaDialog
        isOpen={cancelarAberto}
        repository={repository}
        tenantId={tenantId}
        payableId={payableId}
        onCancelado={handleCancelamentoConcluido}
        onFechar={() => setCancelarAberto(false)}
      />

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

        .dark-theme .conta-pagar-detalhe-titulo {
          color: var(--color-text-primary, #FFF1E6);
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

        .dark-theme .conta-pagar-detalhe-info dd {
          color: var(--color-text-primary, #FFF1E6);
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

        .dark-theme .conta-pagar-detalhe-subtitulo {
          color: var(--color-text-primary, #FFF1E6);
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

        .dark-theme .conta-pagar-detalhe-baixa {
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
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

        .dark-theme .conta-pagar-detalhe-baixa-valor {
          color: var(--color-text-primary, #FFF1E6);
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
