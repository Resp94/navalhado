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

// Tabelas do Hub Financeiro (ticket 08/039): classes compartilhadas entre CaixaTab e
// ComissoesTab, únicas consumidoras de `.financeiro-data-table` e afins em Financeiro.css.
const TABLE_WRAP_CLASSES = 'border border-border rounded-md overflow-x-auto bg-bg-secondary';
const TABLE_CLASSES = 'w-full border-collapse text-sm text-left';
const TH_CLASSES = 'bg-bg-primary px-4 py-3 text-[11px] uppercase tracking-wide font-bold text-text-primary border-b border-border whitespace-nowrap';
const TBODY_CLASSES = 'divide-y divide-border';
const TR_HOVER_CLASSES = 'hover:bg-[rgba(217,108,0,0.025)]';
const TD_CLASSES = 'px-4 py-[0.85rem] text-text-primary';
const TABLE_EMPTY_NOTICE_CLASSES = 'px-4 py-10 text-center text-xs text-text-secondary';
const BTN_TABLE_ACTION_BASE_CLASSES =
  'inline-flex items-center gap-[0.35rem] px-3 py-[0.4rem] rounded-sm text-[11px] font-bold cursor-pointer border-0 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-1 [@media(pointer:coarse)]:min-h-[38px] [@media(pointer:coarse)]:px-[0.85rem] [@media(pointer:coarse)]:py-2';
const BTN_TABLE_ACTION_GHOST_CLASSES = `${BTN_TABLE_ACTION_BASE_CLASSES} bg-transparent text-text-primary shadow-[0_0_0_0.5px_var(--color-text-primary)] hover:bg-[rgba(45,35,30,0.05)] hover:text-text-primary hover:shadow-[0_0_0_0.5px_var(--color-text-primary)]`;
const BTN_TABLE_ACTION_PRIMARY_CLASSES = `${BTN_TABLE_ACTION_BASE_CLASSES} bg-success text-bg-secondary shadow-none hover:bg-success hover:brightness-[0.92] hover:text-bg-secondary hover:shadow-none`;

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
                <div className={TABLE_EMPTY_NOTICE_CLASSES}>
                  Nenhum atendimento ou comissão gerada no período selecionado.
                </div>
              ) : (
                <div className={TABLE_WRAP_CLASSES}>
                  <table className={TABLE_CLASSES}>
                    <thead>
                      <tr>
                        <th className={TH_CLASSES}>Profissional</th>
                        <th className={TH_CLASSES} style={{ textAlign: 'center' }}>Atendimentos</th>
                        <th className={TH_CLASSES}>Total faturado</th>
                        <th className={TH_CLASSES}>Comissão gerada</th>
                        <th className={TH_CLASSES}>Já quitado</th>
                        <th className={TH_CLASSES}>Saldo pendente</th>
                        <th className={TH_CLASSES} style={{ textAlign: 'center' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody className={TBODY_CLASSES}>
                      {metrics.commissions_by_professional.map((p) => (
                        <tr key={p.professional_id || p.professional_name} className={TR_HOVER_CLASSES}>
                          <td className={TD_CLASSES}>
                            <div className="flex items-center gap-[0.6rem] font-bold text-text-primary">
                              <span>{p.professional_name}</span>
                            </div>
                          </td>
                          <td className={TD_CLASSES} style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
                            {p.appointments_count}
                          </td>
                          <td className={TD_CLASSES} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            {formatCurrency(p.gross_sum ?? p.commission_sum)}
                          </td>
                          <td className={TD_CLASSES} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            {formatCurrency(p.commission_sum)}
                          </td>
                          <td className={`${TD_CLASSES} font-bold text-success tabular-nums`}>
                            {formatCurrency(p.paid_sum || 0)}
                          </td>
                          <td className={`${TD_CLASSES} font-extrabold text-brand-primary tabular-nums`}>
                            {formatCurrency(p.pending_sum || 0)}
                          </td>
                          <td className={TD_CLASSES} style={{ textAlign: 'center' }}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedProfForDetails({ id: p.professional_id, name: p.professional_name })}
                                type="button"
                                className={BTN_TABLE_ACTION_GHOST_CLASSES}
                              >
                                Ver comandas
                              </button>
                              <button
                                onClick={() => setSelectedProfForVale({ id: p.professional_id, name: p.professional_name })}
                                type="button"
                                className={BTN_TABLE_ACTION_GHOST_CLASSES}
                              >
                                Vale
                              </button>
                              <button
                                onClick={() => setSelectedProfForExtrato({ id: p.professional_id, name: p.professional_name })}
                                type="button"
                                className={BTN_TABLE_ACTION_GHOST_CLASSES}
                              >
                                Extrato
                              </button>
                              <button
                                onClick={() => setSelectedProfForPayout(p)}
                                type="button"
                                className={BTN_TABLE_ACTION_PRIMARY_CLASSES}
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
                <div className={TABLE_EMPTY_NOTICE_CLASSES}>
                  Nenhum repasse de comissão foi realizado neste período.
                </div>
              ) : (
                <div className={TABLE_WRAP_CLASSES}>
                  <table className={TABLE_CLASSES}>
                    <thead>
                      <tr>
                        <th className={TH_CLASSES}>Data do repasse</th>
                        <th className={TH_CLASSES}>Profissional</th>
                        <th className={TH_CLASSES}>Forma de pagamento</th>
                        <th className={TH_CLASSES}>Valor pago</th>
                        <th className={TH_CLASSES}>Observações</th>
                        <th className={TH_CLASSES}>Status</th>
                        <th className={TH_CLASSES}>Ações</th>
                      </tr>
                    </thead>
                    <tbody className={TBODY_CLASSES}>
                      {payoutsHistory.map((pay) => (
                        <tr
                          key={pay.id}
                          className={TR_HOVER_CLASSES}
                          style={pay.reversed_at ? { opacity: 0.55 } : undefined}
                        >
                          <td className={TD_CLASSES} style={{ fontWeight: 600 }}>{formatDate(pay.paid_at)}</td>
                          <td className={TD_CLASSES} style={{ fontWeight: 700 }}>{pay.professional_name}</td>
                          <td className={TD_CLASSES} style={{ color: 'var(--color-text-secondary)' }}>
                            {PAYMENT_METHOD_LABELS[pay.payment_method] || pay.payment_method}
                          </td>
                          <td className={`${TD_CLASSES} font-bold text-success tabular-nums`}>
                            {formatCurrency(pay.amount)}
                          </td>
                          <td className={TD_CLASSES} style={{ color: 'var(--color-text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pay.notes || ''}>
                            {pay.notes || '-'}
                          </td>
                          <td className={TD_CLASSES}>
                            {pay.reversed_at ? (
                              <span className="inline-block px-[0.6rem] py-[0.15rem] rounded-full text-[0.7rem] font-bold bg-[rgba(240,82,82,0.12)] text-error">Estornado</span>
                            ) : (
                              <span className="inline-block px-[0.6rem] py-[0.15rem] rounded-full text-[0.7rem] font-bold bg-[rgba(14,159,110,0.12)] text-success">Pago</span>
                            )}
                          </td>
                          <td className={TD_CLASSES}>
                            {pay.reversed_at ? (
                              '-'
                            ) : reversingPayoutId === pay.id ? (
                              <div className="flex items-center gap-[0.35rem]">
                                <input
                                  type="text"
                                  className="border border-border rounded-sm px-2 py-[0.35rem] text-[0.8rem] w-40 disabled:opacity-60 disabled:cursor-not-allowed"
                                  placeholder="Motivo do estorno"
                                  value={payoutReversalReason}
                                  onChange={(e) => setPayoutReversalReason(e.target.value)}
                                  aria-label="Motivo do estorno da quitação"
                                  disabled={isReversingPayout}
                                />
                                <button
                                  type="button"
                                  className="bg-error text-white border-none rounded-sm px-[0.6rem] py-[0.35rem] text-xs font-bold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                  onClick={() => handleConfirmPayoutReversal(pay.id)}
                                  disabled={isReversingPayout}
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  className="bg-transparent border-none text-text-secondary text-xs cursor-pointer"
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
                                className={BTN_TABLE_ACTION_GHOST_CLASSES}
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
                    <div className={TABLE_EMPTY_NOTICE_CLASSES} role="alert" style={{ color: 'var(--color-error, #F05252)' }}>
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
