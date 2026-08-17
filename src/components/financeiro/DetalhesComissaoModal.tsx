import React, { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  Invoice01Icon,
  ShoppingBag01Icon,
  ScissorIcon,
} from '@hugeicons/core-free-icons';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/currency';

interface ComandaItemDetail {
  id: string;
  item_type: string;
  total_price: number;
  quantity: number;
  service_name?: string;
  product_name?: string;
  comanda_closed_at: string;
  comanda_id: string;
  customer_name?: string;
}

interface ComandaItemQueryResult {
  id: string;
  item_type: string | null;
  total_price: number | string;
  quantity: number | string | null;
  tenant_id: string;
  comanda: {
    id: string;
    status: string;
    closed_at: string;
    tenant_id: string;
    customer: { name: string } | null;
  } | null;
  service: { name: string } | null;
  product: { name: string } | null;
}

interface DetalhesComissaoModalProps {
  isOpen: boolean;
  professional: {
    id: string;
    name: string;
  } | null;
  startDate: string;
  endDate: string;
  tenantId?: string;
  onClose: () => void;
}

export const DetalhesComissaoModal: React.FC<DetalhesComissaoModalProps> = ({
  isOpen,
  professional,
  startDate,
  endDate,
  tenantId,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ComandaItemDetail[]>([]);

  useEffect(() => {
    if (!isOpen || !professional) return;

    let isMounted = true;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        // Buscar comandas fechadas no período para este profissional com filtro multi-tenant explícito
        let query = supabase
          .from('comanda_itens')
          .select(`
            id,
            item_type,
            total_price,
            quantity,
            tenant_id,
            comanda:comandas!inner(
              id,
              status,
              closed_at,
              tenant_id,
              customer:customers(name)
            ),
            service:services(name),
            product:products(name)
          `)
          .eq('professional_id', professional.id)
          .in('comanda.status', ['fechada', 'closed'])
          .gte('comanda.closed_at', startDate)
          .lte('comanda.closed_at', endDate)
          .order('id', { ascending: false });

        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (isMounted) {
          const rawList = (data || []) as unknown as ComandaItemQueryResult[];
          const mapped: ComandaItemDetail[] = rawList.map((row) => ({
            id: row.id,
            item_type: row.item_type || (row.service ? 'servico' : 'produto'),
            total_price: Number(row.total_price) || 0,
            quantity: Number(row.quantity) || 1,
            service_name: row.service?.name,
            product_name: row.product?.name,
            comanda_closed_at: row.comanda?.closed_at || '',
            comanda_id: row.comanda?.id || '',
            customer_name: row.comanda?.customer?.name || 'Cliente avulso',
          }));
          setItems(mapped);
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes de comanda do profissional:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [isOpen, professional, startDate, endDate, tenantId]);

  if (!isOpen || !professional) return null;

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalFaturado = items.reduce((acc, curr) => acc + curr.total_price, 0);

  return (
    <div
      className="detalhes-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-detalhes-comissao-title"
    >
      <div className="detalhes-modal-shell">
        <div className="detalhes-modal-header">
          <div>
            <h3 id="modal-detalhes-comissao-title" className="detalhes-modal-title">
              Atendimentos e itens faturados
            </h3>
            <p className="detalhes-modal-subtitle">
              Profissional: <strong>{professional.name}</strong> • Total faturado:{' '}
              <span className="text-amber-400 font-semibold">{formatCurrency(totalFaturado)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="detalhes-close-btn"
            aria-label="Fechar modal"
            type="button"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </div>

        <div className="detalhes-modal-body">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Carregando itens faturados...</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              Nenhum item faturado encontrado para este profissional no período selecionado.
            </div>
          ) : (
            <div className="detalhes-items-list">
              {items.map((item) => (
                <div key={item.id} className="detalhes-item-row">
                  <div className="detalhes-item-icon">
                    <HugeiconsIcon
                      icon={item.item_type === 'produto' || item.product_name ? ShoppingBag01Icon : ScissorIcon}
                      size={16}
                    />
                  </div>
                  <div className="detalhes-item-info">
                    <p className="detalhes-item-name">
                      {item.service_name || item.product_name || 'Item de comanda'}
                      {item.quantity > 1 && ` (x${item.quantity})`}
                    </p>
                    <p className="detalhes-item-sub">
                      {item.customer_name} • {formatDate(item.comanda_closed_at)}
                    </p>
                  </div>
                  <div className="detalhes-item-price">
                    {formatCurrency(item.total_price)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="detalhes-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="detalhes-btn-close"
          >
            Fechar
          </button>
        </div>
      </div>

      <style>{`
        .detalhes-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .detalhes-modal-shell {
          background: var(--color-bg-secondary, #18181b);
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
          border-radius: 1rem;
          width: 100%;
          max-width: 540px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: detalhesFadeIn 0.15s ease-out;
        }
        @keyframes detalhesFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .detalhes-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08));
        }
        .detalhes-modal-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text-primary, #f4f4f5);
        }
        .detalhes-modal-subtitle {
          font-size: 0.8125rem;
          color: var(--color-text-secondary, #a1a1aa);
          margin-top: 0.125rem;
        }
        .detalhes-close-btn {
          color: var(--color-text-muted, #71717a);
          padding: 0.25rem;
          border-radius: 0.375rem;
          background: transparent;
          border: none;
          cursor: pointer;
        }
        .detalhes-close-btn:hover {
          color: var(--color-text-primary, #f4f4f5);
          background: rgba(255, 255, 255, 0.05);
        }
        .detalhes-modal-body {
          padding: 1.25rem 1.5rem;
          overflow-y: auto;
          flex: 1;
        }
        .detalhes-items-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .detalhes-item-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.05));
          border-radius: 0.5rem;
        }
        .detalhes-item-icon {
          width: 2rem;
          height: 2rem;
          border-radius: 0.375rem;
          background: rgba(245, 158, 11, 0.1);
          color: var(--color-brand-primary, #f59e0b);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .detalhes-item-info {
          flex: 1;
          min-width: 0;
        }
        .detalhes-item-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-primary, #f4f4f5);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .detalhes-item-sub {
          font-size: 0.75rem;
          color: var(--color-text-muted, #71717a);
        }
        .detalhes-item-price {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-primary, #f4f4f5);
          font-variant-numeric: tabular-nums;
        }
        .detalhes-modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08));
          display: flex;
          justify-content: flex-end;
        }
        .detalhes-btn-close {
          padding: 0.5rem 1rem;
          color: var(--color-text-primary, #f4f4f5);
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
        }
        .detalhes-btn-close:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </div>
  );
};
