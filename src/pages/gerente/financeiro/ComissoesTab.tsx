import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Coins01Icon } from '@hugeicons/core-free-icons';
import { useToast } from '../../../components/Toast';
import { QuitacaoComissaoModal } from '../../../components/financeiro/QuitacaoComissaoModal';
import { LancarValeModal } from '../../../components/financeiro/LancarValeModal';
import { DetalhesComissaoModal } from '../../../components/financeiro/DetalhesComissaoModal';
import { ExtratoContaProfissionalModal } from '../../../components/financeiro/ExtratoContaProfissionalModal';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../lib/currency';
import { PAYMENT_METHOD_LABELS } from '../../../modules/caixa/types';
import { ComissaoRepository } from '../../../modules/comissoes/ComissaoRepository';
import { SupabaseComissaoAdapter } from '../../../modules/comissoes/adapters/SupabaseComissaoAdapter';
import { formatDate } from './formatacao';
import type { FinancialMetrics, PainelContext } from './types';

interface CommissionPayoutHistoryItem {
  id: string;
  professional_id: string;
  professional_name: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  paid_at: string;
  reversed_at: string | null;
}

interface RawPayoutRow {
  id: string;
  professional_id: string;
  amount: number | string;
  payment_method: string;
  notes: string | null;
  paid_at: string;
  reversed_at: string | null;
  professional?: { name: string } | null;
}

/**
 * Aba "Repasses de comissões" do Hub Financeiro, montada pela rota `/financeiro/comissoes`. Lê o
 * tenant e o estado compartilhado do painel (período, métricas, Sessão de Caixa ativa) do
 * contexto entregue pelo layout do painel.
 */
export const ComissoesTab: React.FC = () => {
  const {
    periodStart,
    periodEnd,
    metrics,
    activeSession,
    refresh,
    registerTabReload,
    ...tenant
  } = useOutletContext<PainelContext>();
  const { addToast } = useToast();

  const [comissaoRepo] = useState(() => new ComissaoRepository(new SupabaseComissaoAdapter()));
  const [selectedProfForPayout, setSelectedProfForPayout] = useState<FinancialMetrics['commissions_by_professional'][0] | null>(null);
  const [selectedProfForVale, setSelectedProfForVale] = useState<{ id: string; name: string } | null>(null);
  const [selectedProfForDetails, setSelectedProfForDetails] = useState<{ id: string; name: string } | null>(null);
  const [selectedProfForExtrato, setSelectedProfForExtrato] = useState<{ id: string; name: string } | null>(null);
  const [payoutsHistory, setPayoutsHistory] = useState<CommissionPayoutHistoryItem[]>([]);
  const [reversingPayoutId, setReversingPayoutId] = useState<string | null>(null);
  const [payoutReversalReason, setPayoutReversalReason] = useState<string>('');
  const [payoutReversalError, setPayoutReversalError] = useState<string | null>(null);
  const [isReversingPayout, setIsReversingPayout] = useState(false);

  // Histórico de quitações do período. Quem chama é o painel, que trata o erro da carga inteira.
  const fetchPayoutsHistory = useCallback(async () => {
    if (!tenant?.tenantId) return;

    const { data: payoutsData, error: payoutsError } = await supabase
      .from('commission_payouts')
      .select(`
        id,
        professional_id,
        amount,
        payment_method,
        notes,
        paid_at,
        reversed_at,
        professional:professionals!professional_id(name)
      `)
      .eq('tenant_id', tenant.tenantId)
      .gte('paid_at', periodStart)
      .lte('paid_at', periodEnd)
      .order('paid_at', { ascending: false })
      .limit(20);

    if (!payoutsError && payoutsData) {
      const payoutRows = payoutsData as unknown as RawPayoutRow[];
      setPayoutsHistory(
        payoutRows.map((p) => ({
          id: p.id,
          professional_id: p.professional_id,
          professional_name: p.professional?.name || 'Profissional',
          amount: Number(p.amount) || 0,
          payment_method: p.payment_method,
          notes: p.notes,
          paid_at: p.paid_at,
          reversed_at: p.reversed_at,
        }))
      );
    }
  }, [tenant?.tenantId, periodStart, periodEnd]);

  useEffect(() => registerTabReload(fetchPayoutsHistory), [registerTabReload, fetchPayoutsHistory]);

  const handleConfirmPayoutReversal = async (payoutId: string) => {
    setPayoutReversalError(null);
    if (payoutReversalReason.trim().length < 5) {
      setPayoutReversalError('Informe uma justificativa com pelo menos cinco caracteres.');
      return;
    }
    setIsReversingPayout(true);
    try {
      await comissaoRepo.reversePayout({
        payout_id: payoutId,
        tenant_id: tenant?.tenantId || null,
        reason: payoutReversalReason.trim(),
      });
      setReversingPayoutId(null);
      setPayoutReversalReason('');
      addToast('Quitação estornada com sucesso.', 'success');
      await refresh();
    } catch (err: any) {
      setPayoutReversalError(err?.message || 'Não foi possível estornar a quitação.');
    } finally {
      setIsReversingPayout(false);
    }
  };

  return (
    <>
      {/* Sem visão móvel dedicada: no celular, exibida com as tabelas roláveis que já tem. */}
      <div className="financeiro-tab-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Tabela de Comissões por Barbeiro */}
            <div className="card-panel">
              <div className="card-panel-header">
                <div>
                  <h3 className="card-panel-title">
                    Saldos de comissão por profissional
                  </h3>
                  <p className="card-panel-subtitle">
                    Acompanhe o faturamento de cada barbeiro e quite os repasses pendentes com clareza.
                  </p>
                </div>
              </div>

              {!metrics?.commissions_by_professional || metrics.commissions_by_professional.length === 0 ? (
                <div className="table-empty-notice">
                  Nenhum atendimento ou comissão gerada no período selecionado.
                </div>
              ) : (
                <div className="table-responsive-container">
                  <table className="financeiro-data-table">
                    <thead>
                      <tr>
                        <th>Profissional</th>
                        <th style={{ textAlign: 'center' }}>Atendimentos</th>
                        <th>Total faturado</th>
                        <th>Comissão gerada</th>
                        <th>Já quitado</th>
                        <th>Saldo pendente</th>
                        <th style={{ textAlign: 'center' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.commissions_by_professional.map((p) => (
                        <tr key={p.professional_id || p.professional_name}>
                          <td>
                            <div className="cell-prof-name">
                              <span>{p.professional_name}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
                            {p.appointments_count}
                          </td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            {formatCurrency(p.gross_sum ?? p.commission_sum)}
                          </td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            {formatCurrency(p.commission_sum)}
                          </td>
                          <td className="cell-paid-amount">
                            {formatCurrency(p.paid_sum || 0)}
                          </td>
                          <td className="cell-pending-amount">
                            {formatCurrency(p.pending_sum || 0)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="cell-actions-group">
                              <button
                                onClick={() => setSelectedProfForDetails({ id: p.professional_id, name: p.professional_name })}
                                type="button"
                                className="btn-table-action btn-table-action--ghost"
                              >
                                Ver comandas
                              </button>
                              <button
                                onClick={() => setSelectedProfForVale({ id: p.professional_id, name: p.professional_name })}
                                type="button"
                                className="btn-table-action btn-table-action--ghost"
                              >
                                Vale
                              </button>
                              <button
                                onClick={() => setSelectedProfForExtrato({ id: p.professional_id, name: p.professional_name })}
                                type="button"
                                className="btn-table-action btn-table-action--ghost"
                              >
                                Extrato
                              </button>
                              <button
                                onClick={() => setSelectedProfForPayout(p)}
                                type="button"
                                className="btn-table-action btn-table-action--primary"
                              >
                                <HugeiconsIcon icon={Coins01Icon} size={14} />
                                Pagar comissão
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Histórico de Repasses Quitados */}
            <div className="card-panel">
              <div className="card-panel-header">
                <div>
                  <h3 className="card-panel-title">
                    Histórico de quitações realizadas no período
                  </h3>
                  <p className="card-panel-subtitle">Registro detalhado de todos os pagamentos de comissão efetuados</p>
                </div>
              </div>

              {payoutsHistory.length === 0 ? (
                <div className="table-empty-notice">
                  Nenhum repasse de comissão foi realizado neste período.
                </div>
              ) : (
                <div className="table-responsive-container">
                  <table className="financeiro-data-table">
                    <thead>
                      <tr>
                        <th>Data do repasse</th>
                        <th>Profissional</th>
                        <th>Forma de pagamento</th>
                        <th>Valor pago</th>
                        <th>Observações</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutsHistory.map((pay) => (
                        <tr key={pay.id} style={pay.reversed_at ? { opacity: 0.55 } : undefined}>
                          <td style={{ fontWeight: 600 }}>{formatDate(pay.paid_at)}</td>
                          <td style={{ fontWeight: 700 }}>{pay.professional_name}</td>
                          <td style={{ color: 'var(--color-text-secondary)' }}>
                            {PAYMENT_METHOD_LABELS[pay.payment_method] || pay.payment_method}
                          </td>
                          <td className="cell-paid-amount">
                            {formatCurrency(pay.amount)}
                          </td>
                          <td style={{ color: 'var(--color-text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pay.notes || ''}>
                            {pay.notes || '-'}
                          </td>
                          <td>
                            {pay.reversed_at ? (
                              <span className="payout-status-badge payout-status-badge--reversed">Estornado</span>
                            ) : (
                              <span className="payout-status-badge payout-status-badge--paid">Pago</span>
                            )}
                          </td>
                          <td>
                            {pay.reversed_at ? (
                              '-'
                            ) : reversingPayoutId === pay.id ? (
                              <div className="payout-reversal-form">
                                <input
                                  type="text"
                                  className="payout-reversal-input"
                                  placeholder="Motivo do estorno"
                                  value={payoutReversalReason}
                                  onChange={(e) => setPayoutReversalReason(e.target.value)}
                                  aria-label="Motivo do estorno da quitação"
                                  disabled={isReversingPayout}
                                />
                                <button
                                  type="button"
                                  className="payout-reversal-confirm-btn"
                                  onClick={() => handleConfirmPayoutReversal(pay.id)}
                                  disabled={isReversingPayout}
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  className="payout-reversal-cancel-btn"
                                  onClick={() => {
                                    setReversingPayoutId(null);
                                    setPayoutReversalReason('');
                                    setPayoutReversalError(null);
                                  }}
                                  disabled={isReversingPayout}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn-table-action btn-table-action--ghost"
                                onClick={() => {
                                  setReversingPayoutId(pay.id);
                                  setPayoutReversalReason('');
                                  setPayoutReversalError(null);
                                }}
                              >
                                Estornar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {payoutReversalError && (
                    <div className="table-empty-notice" role="alert" style={{ color: 'var(--color-error, #F05252)' }}>
                      {payoutReversalError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Modal 3: Quitação de Comissão */}
      <QuitacaoComissaoModal
        isOpen={!!selectedProfForPayout}
        professional={selectedProfForPayout}
        tenantId={tenant?.tenantId}
        activeCashSessionId={activeSession?.id ?? null}
        onSuccess={() => {
          setSelectedProfForPayout(null);
          addToast('Quitação de comissão registrada com sucesso!', 'success');
          void refresh();
        }}
        onClose={() => setSelectedProfForPayout(null)}
      />

      {/* Vale de Profissional (ticket 05 da spec 034) */}
      <LancarValeModal
        isOpen={!!selectedProfForVale}
        professional={selectedProfForVale}
        tenantId={tenant?.tenantId}
        activeCashSessionId={activeSession?.id ?? null}
        onSuccess={() => {
          addToast('Vale atualizado com sucesso!', 'success');
          void refresh();
        }}
        onClose={() => setSelectedProfForVale(null)}
      />

      {/* Modal 4: Detalhes de Comandas do Profissional */}
      <DetalhesComissaoModal
        isOpen={!!selectedProfForDetails}
        professional={selectedProfForDetails}
        startDate={periodStart}
        endDate={periodEnd}
        tenantId={tenant?.tenantId}
        onClose={() => setSelectedProfForDetails(null)}
      />

      {/* Modal 5: Extrato cronológico da Conta do Profissional */}
      <ExtratoContaProfissionalModal
        isOpen={!!selectedProfForExtrato}
        professional={selectedProfForExtrato}
        tenantId={tenant?.tenantId}
        onClose={() => setSelectedProfForExtrato(null)}
      />
    </>
  );
};
