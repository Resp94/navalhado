import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Coins01Icon,
  CheckmarkCircle02Icon,
  PlusSignIcon,
  Clock01Icon,
  InformationCircleIcon,
  UserGroupIcon,
  SmartPhone01Icon,
} from '@hugeicons/core-free-icons';
import { LockIcon } from '../../../components/Icons';
import { formatCurrency } from '../../../lib/currency';
import type { CashSession } from '../../../modules/caixa/types';
import type { FinancialMetrics } from '../Financeiro';

interface MobileCaixaViewProps {
  activeSession: CashSession | null;
  activeSessionCashReceipts: number;
  metrics: FinancialMetrics | null;
  historySessions: CashSession[];
  onOpenAbertura: () => void;
  onOpenFechamento: () => void;
  formatDate: (dateStr: string) => string;
}

export const MobileCaixaView: React.FC<MobileCaixaViewProps> = ({
  activeSession,
  activeSessionCashReceipts,
  metrics,
  historySessions,
  onOpenAbertura,
  onOpenFechamento,
  formatDate,
}) => {
  const pixTotal = metrics?.revenue_by_method?.['pix'] || 0;
  const cardTotal =
    (metrics?.revenue_by_method?.['cartao_credito'] || 0) +
    (metrics?.revenue_by_method?.['cartao_debito'] || 0);
  const moneyTotal =
    (metrics?.revenue_by_method?.['dinheiro'] || 0) +
    (activeSession?.initial_amount || 0);

  return (
    <div className="mobile-caixa">
      {/* ─── 1. STATUS DO CAIXA DO DIA ─── */}
      <div className={`mobile-caixa__status-card ${activeSession ? 'status--open' : 'status--closed'}`}>
        <div className="mobile-caixa__status-header">
          <div className="mobile-caixa__status-badge">
            <span className="mobile-caixa__status-dot" />
            <span>{activeSession ? 'Caixa Aberto' : 'Caixa Fechado'}</span>
          </div>

          {activeSession && (
            <span className="mobile-caixa__opened-time">
              <HugeiconsIcon icon={Clock01Icon} size={14} />
              {formatDate(activeSession.opened_at)}
            </span>
          )}
        </div>

        <div className="mobile-caixa__status-body">
          {activeSession ? (
            <div className="mobile-caixa__amount-row">
              <div>
                <span className="mobile-caixa__amount-label">Troco Inicial</span>
                <span className="mobile-caixa__amount-val">
                  {formatCurrency(activeSession.initial_amount)}
                </span>
              </div>
              <div>
                <span className="mobile-caixa__amount-label">Dinheiro Recebido</span>
                <span className="mobile-caixa__amount-val text-success">
                  +{formatCurrency(activeSessionCashReceipts)}
                </span>
              </div>
            </div>
          ) : (
            <p className="mobile-caixa__closed-msg">
              Inicie o turno para liberar o recebimento de comandas em dinheiro e pagamentos.
            </p>
          )}
        </div>

        <div className="mobile-caixa__status-footer">
          {activeSession ? (
            <button
              type="button"
              className="mobile-caixa__btn-action btn--close-caixa"
              onClick={onOpenFechamento}
            >
              <LockIcon size={16} />
              <span>Fechar Caixa do Turno</span>
            </button>
          ) : (
            <button
              type="button"
              className="mobile-caixa__btn-action btn--open-caixa"
              onClick={onOpenAbertura}
            >
              <HugeiconsIcon icon={PlusSignIcon} size={18} />
              <span>Abrir Caixa do Turno</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. RESUMO DOS VALORES DO DIA (4 CARDS) ─── */}
      <div className="mobile-caixa__cards-grid">
        <div className="mobile-caixa__kpi-card">
          <span className="mobile-caixa__kpi-label">Faturamento Total</span>
          <span className="mobile-caixa__kpi-val text-primary">
            {formatCurrency(metrics?.total_revenue || 0)}
          </span>
        </div>

        <div className="mobile-caixa__kpi-card">
          <span className="mobile-caixa__kpi-label">Dinheiro em Gaveta</span>
          <span className="mobile-caixa__kpi-val">
            {formatCurrency(moneyTotal)}
          </span>
        </div>

        <div className="mobile-caixa__kpi-card">
          <span className="mobile-caixa__kpi-label">Recebimentos PIX</span>
          <span className="mobile-caixa__kpi-val text-info">
            {formatCurrency(pixTotal)}
          </span>
        </div>

        <div className="mobile-caixa__kpi-card">
          <span className="mobile-caixa__kpi-label">Cartão Crédito / Débito</span>
          <span className="mobile-caixa__kpi-val">
            {formatCurrency(cardTotal)}
          </span>
        </div>
      </div>

      {/* ─── 3. BANNER INFORMATIVO (DESKTOP NOTIFICATION) ─── */}
      <div className="mobile-caixa__desktop-notice">
        <div className="mobile-caixa__notice-icon">
          <HugeiconsIcon icon={InformationCircleIcon} size={20} />
        </div>
        <div className="mobile-caixa__notice-content">
          <h4 className="mobile-caixa__notice-title">Relatórios Completos no Desktop</h4>
          <p className="mobile-caixa__notice-desc">
            DRE aprofundado, gráficos de evolução temporal e análises detalhadas por período estão disponíveis na versão desktop.
          </p>
        </div>
      </div>

      {/* ─── 4. ÚLTIMOS TURNOS / MOVIMENTAÇÕES ─── */}
      <div className="mobile-caixa__history">
        <h3 className="mobile-caixa__history-title">Turnos Recentes</h3>
        {historySessions.length === 0 ? (
          <div className="mobile-caixa__history-empty">
            <span>Nenhum histórico de turno registrado ainda.</span>
          </div>
        ) : (
          <div className="mobile-caixa__history-list">
            {historySessions.slice(0, 5).map((session) => (
              <div key={session.id} className="mobile-caixa__history-item">
                <div className="mobile-caixa__history-info">
                  <span className="mobile-caixa__history-date">
                    {formatDate(session.opened_at)}
                  </span>
                  <span className="mobile-caixa__history-status">
                    {session.closed_at ? 'Fechado' : 'Aberto'}
                  </span>
                </div>
                <div className="mobile-caixa__history-amounts">
                  <span>Troco: {formatCurrency(session.initial_amount)}</span>
                  {session.closing_amount !== null && (
                    <span className="mobile-caixa__history-final">
                      Final: {formatCurrency(session.closing_amount)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .mobile-caixa {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
        }

        .mobile-caixa__status-card {
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .mobile-caixa__status-card.status--open {
          border-color: rgba(16, 185, 129, 0.3);
        }

        .mobile-caixa__status-card.status--closed {
          border-color: rgba(239, 68, 68, 0.25);
        }

        .mobile-caixa__status-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mobile-caixa__status-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: #f4f4f5;
        }

        .status--open .mobile-caixa__status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .status--closed .mobile-caixa__status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
        }

        .mobile-caixa__opened-time {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          color: #a1a1aa;
        }

        .mobile-caixa__amount-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.03);
          padding: 0.75rem;
          border-radius: 10px;
        }

        .mobile-caixa__amount-label {
          font-size: 0.6875rem;
          color: #71717a;
          text-transform: uppercase;
          display: block;
        }

        .mobile-caixa__amount-val {
          font-size: 1rem;
          font-weight: 700;
          color: #f4f4f5;
        }

        .text-success { color: #10b981 !important; }
        .text-primary { color: #f59e0b !important; }
        .text-info { color: #60a5fa !important; }

        .mobile-caixa__closed-msg {
          font-size: 0.8125rem;
          color: #a1a1aa;
          margin: 0;
        }

        .mobile-caixa__btn-action {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 10px;
          font-size: 0.875rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          min-height: 48px;
          transition: all 0.2s ease;
        }

        .btn--open-caixa {
          background: #f59e0b;
          color: #18181b;
        }

        .btn--close-caixa {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .mobile-caixa__cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .mobile-caixa__kpi-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 0.875rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
        }

        .mobile-caixa__kpi-label {
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
          text-transform: uppercase;
        }

        .mobile-caixa__kpi-val {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .mobile-caixa__desktop-notice {
          display: flex;
          gap: 0.75rem;
          background: rgba(245, 158, 11, 0.08);
          border: 1px dashed rgba(245, 158, 11, 0.3);
          border-radius: 12px;
          padding: 0.875rem;
          align-items: flex-start;
        }

        .mobile-caixa__notice-icon {
          color: var(--color-brand-primary, #f59e0b);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .mobile-caixa__notice-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-brand-primary, #f59e0b);
          margin: 0 0 0.15rem;
        }

        .mobile-caixa__notice-desc {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.4;
        }

        .mobile-caixa__history {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .mobile-caixa__history-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .mobile-caixa__history-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .mobile-caixa__history-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          padding: 0.75rem;
          box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
          font-size: 0.8125rem;
        }

        .mobile-caixa__history-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .mobile-caixa__history-date {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .mobile-caixa__history-status {
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
        }

        .mobile-caixa__history-amounts {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.15rem;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .mobile-caixa__history-final {
          font-weight: 700;
          color: var(--color-brand-primary, #f59e0b);
        }

        .mobile-caixa__history-empty {
          padding: 1.5rem;
          text-align: center;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          background: var(--color-bg-secondary);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};
