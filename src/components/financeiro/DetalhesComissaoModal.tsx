import React, { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
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
  timezone?: string;
  onClose: () => void;
}

export const DetalhesComissaoModal: React.FC<DetalhesComissaoModalProps> = ({
  isOpen,
  professional,
  startDate,
  endDate,
  tenantId,
  timezone,
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
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalFaturado = items.reduce((acc, curr) => acc + curr.total_price, 0);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[rgba(20,17,15,0.55)] backdrop-blur-[8px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-detalhes-comissao-title"
    >
      <div className="bg-bg-secondary border border-border rounded-lg w-full max-w-[560px] max-h-[85vh] flex flex-col shadow-xl overflow-hidden animate-dialog-in">
        <div className="flex items-start justify-between px-6 py-5 border-b border-border bg-bg-secondary">
          <div>
            <h3 id="modal-detalhes-comissao-title" className="text-lg font-extrabold text-text-primary m-0 tracking-[-0.01em]">
              Extrato de atendimentos e itens faturados
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Produção de <strong>{professional.name}</strong> • Total faturado:{' '}
              <span className="text-brand-primary font-extrabold [font-variant-numeric:tabular-nums]">{formatCurrency(totalFaturado)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary p-1.5 rounded-sm bg-transparent border-none cursor-pointer flex items-center justify-center transition-all duration-200 ease-in hover:text-text-primary hover:bg-bg-primary"
            aria-label="Fechar extrato"
            type="button"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-10 px-4 text-center text-sm text-text-secondary">Buscando itens faturados...</div>
          ) : items.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-text-secondary">
              Nenhum item ou serviço concluído para este profissional no período selecionado.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 px-4 py-3.5 bg-bg-primary border border-border rounded-md transition-all duration-200 ease-in hover:border-brand-soft hover:shadow-sm"
                >
                  <div className="w-9 h-9 rounded-md bg-[rgba(217,108,0,0.12)] text-brand-primary flex items-center justify-center shrink-0">
                    <HugeiconsIcon
                      icon={item.item_type === 'produto' || item.product_name ? ShoppingBag01Icon : ScissorIcon}
                      size={18}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary whitespace-nowrap overflow-hidden text-ellipsis m-0">
                      {item.service_name || item.product_name || 'Item de comanda'}
                      {item.quantity > 1 && ` (x${item.quantity})`}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {item.customer_name} • {formatDate(item.comanda_closed_at)}
                    </p>
                  </div>
                  <div className="text-sm font-extrabold text-text-primary [font-variant-numeric:tabular-nums]">
                    {formatCurrency(item.total_price)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end bg-bg-secondary">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-text-primary bg-bg-primary border border-border rounded-md text-sm font-bold cursor-pointer transition-all duration-200 ease-in hover:border-brand-primary hover:text-brand-primary"
          >
            Fechar extrato
          </button>
        </div>
      </div>
    </div>
  );
};
