import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { ComandaCheckoutModal } from '../../components/comandas/ComandaCheckoutModal';
import { openWhatsApp } from '../../lib/whatsapp';
import { ComandaRepository } from '../../modules/comandas/ComandaRepository';
import { SupabaseComandaAdapter } from '../../modules/comandas/adapters/SupabaseComandaAdapter';
import type { ComandaEnriched } from '../../modules/comandas/types';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Invoice01Icon,
  Search01Icon,
  PlusSignIcon,
  Money01Icon,
  CheckmarkCircle02Icon,
  WhatsappIcon,
  UserIcon,
  Calendar02Icon,
  Store01Icon,
} from '@hugeicons/core-free-icons';

export const Comandas: React.FC = () => {
  const { tenantId, tenantName } = useOutletContext<TenantContextType>();
  const { addToast } = useToast();
  const comandaRepo = useMemo(() => new ComandaRepository(new SupabaseComandaAdapter()), []);

  const [loading, setLoading] = useState(true);
  const [comandas, setComandas] = useState<ComandaEnriched[]>([]);
  const [statusFilter, setStatusFilter] = useState<'aberta' | 'fechada' | 'all'>('aberta');
  const [searchTerm, setSearchTerm] = useState('');

  // Estados do Modal de Checkout
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedComanda, setSelectedComanda] = useState<ComandaEnriched | null>(null);

  // Dados auxiliares para o modal
  const [services, setServices] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [professionals, setProfessionals] = useState<Array<{ id: string; name: string }>>([]);

  const carregarDados = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);

      // 1. Carregar serviços e profissionais
      const [srvRes, profRes, enrichedCmds] = await Promise.all([
        supabase
          .from('services')
          .select('id, name, price')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        supabase
          .from('professionals')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        comandaRepo.listAll(tenantId),
      ]);

      if (srvRes.data) setServices(srvRes.data);
      if (profRes.data) setProfessionals(profRes.data);
      setComandas(enrichedCmds);
    } catch (err: any) {
      console.error('Erro ao carregar comandas:', err);
      addToast('Não foi possível carregar as comandas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, addToast, comandaRepo]);

  useEffect(() => {
    carregarDados();

    if (!tenantId || typeof supabase.channel !== 'function') return;

    const channel = supabase
      .channel(`realtime-comandas-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comandas', filter: `tenant_id=eq.${tenantId}` },
        () => {
          carregarDados();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comanda_itens', filter: `tenant_id=eq.${tenantId}` },
        () => {
          carregarDados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregarDados, tenantId]);

  // Filtragem
  const filteredComandas = useMemo(() => {
    return comandas.filter((c) => {
      // Filtro de status
      if (statusFilter === 'aberta' && c.status !== 'aberta') return false;
      if (statusFilter === 'fechada' && c.status !== 'fechada') return false;

      // Filtro de busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const clientMatch = c.customer_name?.toLowerCase().includes(term);
        const codeMatch = (c.comanda_number ? String(c.comanda_number) : '').toLowerCase().includes(term);
        const profMatch = c.professional_name?.toLowerCase().includes(term);
        return clientMatch || codeMatch || profMatch;
      }
      return true;
    });
  }, [comandas, statusFilter, searchTerm]);

  const handleOpenCheckoutModal = (cmd: ComandaEnriched) => {
    setSelectedComanda(cmd);
    setIsCheckoutOpen(true);
  };

  const handleOpenNovaAvulsa = () => {
    setSelectedComanda(null);
    setIsCheckoutOpen(true);
  };

  const handleFinalizado = () => {
    setIsCheckoutOpen(false);
    setSelectedComanda(null);
    carregarDados();
    addToast('Comanda atualizada com sucesso!', 'success');
  };

  const handleDirectWhatsApp = (phone: string, name: string) => {
    openWhatsApp(phone, `Olá ${name}! Tudo bem? Falamos da ${tenantName || 'barbearia'}.`);
  };

  return (
    <div className="comandas-page">
      {/* ─── CABEÇALHO DA PÁGINA ─── */}
      <div className="comandas-header">
        <div className="comandas-header__titles">
          <h1 className="comandas-header__title">Comandas e atendimentos</h1>
          <p className="comandas-header__subtitle">
            Gerencie o consumo de produtos, serviços e checkout rápido de balcão
          </p>
        </div>

        <button
          type="button"
          className="comandas-header__btn-nova"
          onClick={handleOpenNovaAvulsa}
        >
          <HugeiconsIcon icon={PlusSignIcon} size={18} />
          <span>Nova comanda avulsa</span>
        </button>
      </div>

      {/* ─── FILTROS E BUSCA ─── */}
      <div className="comandas-toolbar">
        <div className="comandas-search">
          <HugeiconsIcon icon={Search01Icon} size={18} className="comandas-search__icon" />
          <input
            type="text"
            placeholder="Buscar por cliente, código ou profissional..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="comandas-search__input"
          />
        </div>

        <div className="comandas-tabs">
          <button
            type="button"
            className={`comandas-tab ${statusFilter === 'aberta' ? 'comandas-tab--active' : ''}`}
            onClick={() => setStatusFilter('aberta')}
          >
            <span>Abertas</span>
            <span className="comandas-tab__badge">
              {comandas.filter((c) => c.status === 'aberta').length}
            </span>
          </button>
          <button
            type="button"
            className={`comandas-tab ${statusFilter === 'fechada' ? 'comandas-tab--active' : ''}`}
            onClick={() => setStatusFilter('fechada')}
          >
            <span>Pagas</span>
          </button>
          <button
            type="button"
            className={`comandas-tab ${statusFilter === 'all' ? 'comandas-tab--active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <span>Todas</span>
          </button>
        </div>
      </div>

      {/* ─── LISTAGEM DE COMANDAS ─── */}
      {loading ? (
        <div className="comandas-loading">
          <div className="spinner" />
          <span>Carregando comandas...</span>
        </div>
      ) : filteredComandas.length === 0 ? (
        <div className="comandas-empty">
          <div className="comandas-empty__icon">
            <HugeiconsIcon icon={Invoice01Icon} size={36} />
          </div>
          <h3>Nenhuma comanda encontrada</h3>
          <p>
            {searchTerm
              ? 'Nenhum resultado para os termos pesquisados.'
              : statusFilter === 'aberta'
              ? 'Não há comandas abertas no momento.'
              : 'Nenhum registro de comanda nesta categoria.'}
          </p>
          <button
            type="button"
            className="comandas-empty__btn"
            onClick={handleOpenNovaAvulsa}
          >
            <HugeiconsIcon icon={PlusSignIcon} size={16} />
            Abrir comanda avulsa
          </button>
        </div>
      ) : (
        <div className="comandas-grid">
          {filteredComandas.map((cmd) => {
            const isOpen = cmd.status === 'aberta';
            const total = Number(cmd.total_amount || 0);
            const itensCount = cmd.itens?.length || 0;

            return (
              <div
                key={cmd.id}
                className={`comanda-card ${isOpen ? 'comanda-card--open' : 'comanda-card--paid'}`}
                onClick={() => handleOpenCheckoutModal(cmd)}
              >
                <div className="comanda-card__header">
                  <div className="comanda-card__code">
                    <HugeiconsIcon icon={Invoice01Icon} size={16} />
                    <span>{cmd.comanda_number ? `#${cmd.comanda_number}` : `CMD-${cmd.id.slice(0, 5).toUpperCase()}`}</span>
                  </div>
                  <span className={`comanda-card__status ${isOpen ? 'status--open' : 'status--paid'}`}>
                    {isOpen ? 'Aberta' : 'Paga'}
                  </span>
                </div>

                <div className="comanda-card__body">
                  <div className="comanda-card__client">
                    <HugeiconsIcon icon={UserIcon} size={16} className="comanda-card__client-icon" />
                    <span className="comanda-card__client-name">{cmd.customer_name}</span>
                  </div>

                  {cmd.appointment_id ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: cmd.appointment_is_fitting ? 'rgba(217, 108, 0, 0.12)' : 'rgba(45, 35, 30, 0.06)',
                      color: cmd.appointment_is_fitting ? 'var(--color-brand-primary)' : 'var(--color-text-primary)',
                      marginTop: '4px',
                      marginBottom: '4px',
                      width: 'fit-content',
                    }}>
                      <HugeiconsIcon icon={Calendar02Icon} size={13} />
                      <span>
                        {cmd.appointment_is_fitting ? 'Encaixe: ' : 'Agendamento: '}
                        {cmd.appointment_start_time
                          ? `${new Date(cmd.appointment_start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date(cmd.appointment_start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                          : ''}
                        {cmd.appointment_service_name ? ` • ${cmd.appointment_service_name}` : ''}
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(45, 35, 30, 0.04)',
                      color: 'var(--color-text-secondary)',
                      marginTop: '4px',
                      marginBottom: '4px',
                      width: 'fit-content',
                    }}>
                      <HugeiconsIcon icon={Store01Icon} size={13} />
                      <span>Atendimento Balcão / Avulsa</span>
                    </div>
                  )}

                  <div className="comanda-card__meta">
                    <span className="comanda-card__prof">{cmd.professional_name}</span>
                    <span className="comanda-card__itens-count">
                      {itensCount} {itensCount === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                </div>

                <div className="comanda-card__footer">
                  <div className="comanda-card__total">
                    <span className="comanda-card__total-label">Total</span>
                    <span className="comanda-card__total-value">R$ {total.toFixed(2)}</span>
                  </div>

                  <div className="comanda-card__actions" onClick={(e) => e.stopPropagation()}>
                    {cmd.customer_phone && (
                      <button
                        type="button"
                        className="comanda-card__action-btn comanda-card__action-btn--whatsapp"
                        onClick={() => handleDirectWhatsApp(cmd.customer_phone!, cmd.customer_name || '')}
                        title="WhatsApp"
                      >
                        <HugeiconsIcon icon={WhatsappIcon} size={16} />
                      </button>
                    )}

                    {isOpen ? (
                      <button
                        type="button"
                        className="comanda-card__action-btn comanda-card__action-btn--checkout"
                        onClick={() => handleOpenCheckoutModal(cmd)}
                      >
                        <HugeiconsIcon icon={Money01Icon} size={16} />
                        <span>Cobrar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="comanda-card__action-btn comanda-card__action-btn--view"
                        onClick={() => handleOpenCheckoutModal(cmd)}
                      >
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                        <span>Ver detalhes</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL DE CHECKOUT / DETALHES ─── */}
      {isCheckoutOpen && (
        <ComandaCheckoutModal
          isOpen={isCheckoutOpen}
          tenantId={tenantId}
          appointmentId={selectedComanda?.appointment_id || null}
          customerId={selectedComanda?.customer_id || null}
          customerName={selectedComanda?.customer_name || 'Cliente Balcão'}
          customerPhone={selectedComanda?.customer_phone || null}
          availableServices={services}
          availableProfessionals={professionals}
          onClose={() => setIsCheckoutOpen(false)}
          onFinalizado={handleFinalizado}
        />
      )}

      <style>{`
        .comandas-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
        }

        .comandas-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .comandas-header__title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .comandas-header__subtitle {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0.25rem 0 0;
        }

        .comandas-header__btn-nova {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
          border: none;
          padding: 0.65rem 1.15rem;
          border-radius: var(--radius-md, 10px);
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
        }

        .comandas-header__btn-nova:hover {
          background: var(--color-brand-hover);
        }

        .comandas-toolbar {
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .comandas-search {
          flex: 1;
          min-width: 260px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md, 10px);
          padding: 0.6rem 0.875rem;
        }

        .comandas-search__icon {
          color: var(--color-text-secondary);
        }

        .comandas-search__input {
          background: transparent;
          border: none;
          color: var(--color-text-primary);
          font-size: 0.875rem;
          width: 100%;
          outline: none;
        }

        .comandas-tabs {
          display: flex;
          gap: 0.375rem;
          background: var(--color-bg-secondary);
          padding: 3px;
          border-radius: var(--radius-md, 10px);
          border: 1px solid var(--color-border);
        }

        .comandas-tab {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.45rem 0.85rem;
          border-radius: var(--radius-sm, 8px);
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .comandas-tab--active {
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.1));
        }

        .comandas-tab__badge {
          font-size: 0.6875rem;
          background: rgba(217, 108, 0, 0.15);
          color: var(--color-brand-primary);
          padding: 1px 6px;
          border-radius: var(--radius-full, 9999px);
        }

        .comandas-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
        }

        .comanda-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 14px);
          padding: 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
        }

        .comanda-card:hover {
          border-color: var(--color-brand-primary);
          transform: translateY(-2px);
        }

        .comanda-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .comanda-card__code {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .comanda-card__status {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: var(--radius-sm, 6px);
        }

        .status--open {
          background: rgba(217, 108, 0, 0.15);
          color: var(--color-brand-primary);
        }

        .status--paid {
          background: rgba(14, 159, 110, 0.15);
          color: var(--color-success);
        }

        .comanda-card__body {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .comanda-card__client {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .comanda-card__client-icon {
          color: var(--color-text-secondary);
        }

        .comanda-card__client-name {
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .comanda-card__meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .comanda-card__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 0.75rem;
          border-top: 1px solid var(--color-border);
        }

        .comanda-card__total-label {
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          display: block;
        }

        .comanda-card__total-value {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-brand-primary);
        }

        .comanda-card__actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .comanda-card__action-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.875rem;
          border-radius: var(--radius-sm, 8px);
          font-size: 0.8125rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .comanda-card__action-btn--whatsapp {
          background: rgba(14, 159, 110, 0.12);
          color: var(--color-success);
          border: 1px solid rgba(14, 159, 110, 0.25);
          padding: 0.5rem;
        }

        .comanda-card__action-btn--checkout {
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
          font-weight: 700;
        }

        .comanda-card__action-btn--view {
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
        }

        .comandas-loading,
        .comandas-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 1.5rem;
          text-align: center;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 16px);
        }

        .comandas-empty__icon {
          color: var(--color-text-secondary);
          margin-bottom: 0.75rem;
        }

        .comandas-empty__btn {
          margin-top: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
          padding: 0.65rem 1.25rem;
          border-radius: var(--radius-md, 10px);
          border: none;
          font-weight: 700;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .comandas-empty__btn:hover {
          background: var(--color-brand-hover);
        }

        @media (max-width: 768px) {
          .comandas-header {
            flex-direction: column;
            align-items: stretch;
          }
          .comandas-header__btn-nova {
            justify-content: center;
            padding: 0.85rem;
            font-size: 0.9375rem;
            min-height: 48px;
          }
          .comandas-toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .comandas-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
