import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { dateInZone, formatTimeInZone } from '../../lib/timezone';
import { ComandaCheckoutModal } from '../../components/comandas/ComandaCheckoutModal';
import { openWhatsApp } from '../../lib/whatsapp';
import { ComandaRepository } from '../../modules/comandas/ComandaRepository';
import { SupabaseComandaAdapter } from '../../modules/comandas/adapters/SupabaseComandaAdapter';
import type { ComandaEnriched } from '../../modules/comandas/types';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Invoice01Icon,
  PlusSignIcon,
  Money01Icon,
  CheckmarkCircle02Icon,
  WhatsappIcon,
  UserIcon,
  Calendar02Icon,
  Store01Icon,
} from '@hugeicons/core-free-icons';
import {
  Button,
  IconButton,
  SearchInput,
  SegmentedControl,
  EmptyState,
  Badge,
} from '../../components/ui';

export const Comandas: React.FC = () => {
  const { tenantId, tenantName, timezone } = useOutletContext<TenantContextType>();
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

  const getAppointmentOrigin = (comanda: ComandaEnriched) =>
    comanda.appointment_is_fitting === true ? 'Encaixe' : 'Agendamento';

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
    <div className="flex flex-col gap-5 w-full">
      {/* ─── CABEÇALHO DA PÁGINA ─── */}
      <div className="flex items-center justify-between gap-4 max-[768px]:flex-col max-[768px]:items-stretch">
        <div>
          <h1 className="text-2xl font-bold text-text-primary m-0">Comandas e atendimentos</h1>
          <p className="text-sm text-text-secondary mt-1 mb-0">
            Gerencie o consumo de produtos, serviços e checkout rápido de balcão
          </p>
        </div>

        <Button
          variant="primary"
          icon={<HugeiconsIcon icon={PlusSignIcon} size={18} />}
          onClick={handleOpenNovaAvulsa}
        >
          Nova comanda avulsa
        </Button>
      </div>

      {/* ─── FILTROS E BUSCA ─── */}
      <div className="flex gap-4 items-center flex-wrap max-[768px]:flex-col max-[768px]:flex-nowrap max-[768px]:items-stretch">
        <div style={{ flex: 1, minWidth: '260px' }}>
          <SearchInput
            placeholder="Buscar por cliente, código ou profissional..."
            value={searchTerm}
            onChange={setSearchTerm}
            onClear={() => setSearchTerm('')}
          />
        </div>

        <SegmentedControl<'aberta' | 'fechada' | 'all'>
          value={statusFilter}
          onChange={setStatusFilter}
          fullWidth={false}
          options={[
            {
              id: 'aberta',
              label: 'Abertas',
              count: comandas.filter((c) => c.status === 'aberta').length,
            },
            { id: 'fechada', label: 'Pagas' },
            { id: 'all', label: 'Todas' },
          ]}
        />
      </div>

      {/* ─── LISTAGEM DE COMANDAS ─── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-bg-secondary border border-border rounded-lg">
          <div className="spinner" />
          <span>Carregando comandas...</span>
        </div>
      ) : filteredComandas.length === 0 ? (
        <EmptyState
          icon={<HugeiconsIcon icon={Invoice01Icon} size={32} />}
          title="Nenhuma comanda encontrada"
          description={
            searchTerm
              ? 'Nenhum resultado para os termos pesquisados.'
              : statusFilter === 'aberta'
              ? 'Não há comandas abertas no momento.'
              : 'Nenhum registro de comanda nesta categoria.'
          }
          action={
            <Button
              variant="primary"
              icon={<HugeiconsIcon icon={PlusSignIcon} size={16} />}
              onClick={handleOpenNovaAvulsa}
            >
              Abrir comanda avulsa
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] max-[768px]:grid-cols-1">
          {filteredComandas.map((cmd) => {
            const isOpen = cmd.status === 'aberta';
            const total = Number(cmd.total_amount || 0);
            const itensCount = cmd.itens?.length || 0;

            return (
              <div
                key={cmd.id}
                className="bg-bg-secondary border border-border rounded-lg p-[1.15rem] flex flex-col gap-3.5 cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-sm hover:border-brand-primary hover:-translate-y-0.5"
                onClick={() => handleOpenCheckoutModal(cmd)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-text-secondary">
                    <HugeiconsIcon icon={Invoice01Icon} size={16} />
                    <span>{cmd.comanda_number ? `#${cmd.comanda_number}` : `CMD-${cmd.id.slice(0, 5).toUpperCase()}`}</span>
                  </div>
                  <Badge variant={isOpen ? 'brand' : 'success'} size="xs">
                    {isOpen ? 'Aberta' : 'Paga'}
                  </Badge>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={UserIcon} size={16} className="text-text-secondary" />
                    <span className="text-[1.0625rem] font-bold text-text-primary">{cmd.customer_name}</span>
                  </div>

                  {cmd.appointment_id ? (
                    <div
                      className={`inline-flex items-center gap-[5px] px-2 py-[3px] rounded-sm text-[0.6875rem] font-semibold my-0.5 w-fit ${cmd.appointment_is_fitting === true ? 'bg-[rgba(217,108,0,0.12)] text-brand-primary' : 'bg-[rgba(45,35,30,0.06)] text-text-primary'}`}
                      data-testid={`comanda-origin-${cmd.id}`}
                    >
                      <HugeiconsIcon icon={Calendar02Icon} size={13} />
                      <span>
                        <strong>{getAppointmentOrigin(cmd)}</strong>{': '}
                        {cmd.appointment_start_time
                          ? `${dateInZone(new Date(cmd.appointment_start_time), timezone).split('-').reverse().join('/')} às ${formatTimeInZone(cmd.appointment_start_time, timezone)}`
                          : ''}
                        {cmd.appointment_service_name ? ` • ${cmd.appointment_service_name}` : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-[5px] px-2 py-[3px] rounded-sm text-[0.6875rem] font-semibold my-0.5 w-fit bg-[rgba(45,35,30,0.04)] text-text-secondary">
                      <HugeiconsIcon icon={Store01Icon} size={13} />
                      <span>Atendimento Balcão / Avulsa</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[0.8125rem] text-text-secondary">
                    <span>{cmd.professional_name}</span>
                    <span>
                      {itensCount} {itensCount === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <span className="text-[0.6875rem] text-text-secondary uppercase block">Total</span>
                    <span className="text-lg font-extrabold text-brand-primary">R$ {total.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {cmd.customer_phone && (
                      <IconButton
                        aria-label="WhatsApp"
                        title="WhatsApp"
                        variant="ghost"
                        size="sm"
                        // !important needed: IconButton (src/components/ui, not editable here) appends its
                        // own variant classes after this className, so plain utilities of equal specificity
                        // would lose to the "ghost" variant's bg/text classes.
                        className="text-success! bg-[rgba(14,159,110,0.12)]! border! border-[rgba(14,159,110,0.25)]!"
                        onClick={() => handleDirectWhatsApp(cmd.customer_phone!, cmd.customer_name || '')}
                        icon={<HugeiconsIcon icon={WhatsappIcon} size={16} />}
                      />
                    )}

                    {isOpen ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<HugeiconsIcon icon={Money01Icon} size={16} />}
                        onClick={() => handleOpenCheckoutModal(cmd)}
                      >
                        Cobrar
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />}
                        onClick={() => handleOpenCheckoutModal(cmd)}
                      >
                        Ver detalhes
                      </Button>
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
          comandaId={selectedComanda?.id || null}
          appointmentId={selectedComanda?.appointment_id || null}
          appointmentStartTime={selectedComanda?.appointment_start_time || null}
          appointmentServiceName={selectedComanda?.appointment_service_name || null}
          appointmentIsFitting={selectedComanda?.appointment_is_fitting || false}
          customerId={selectedComanda?.customer_id || null}
          customerName={selectedComanda?.customer_name || 'Cliente Balcão'}
          customerPhone={selectedComanda?.customer_phone || null}
          availableServices={services}
          availableProfessionals={professionals}
          onClose={() => setIsCheckoutOpen(false)}
          onFinalizado={handleFinalizado}
        />
      )}
    </div>
  );
};
