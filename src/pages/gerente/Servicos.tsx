import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Clock01Icon,
  ArrowReloadHorizontalIcon,
  BadgePercentIcon,
  Edit01Icon,
  WhatsappIcon,
  PlusSignIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  ScissorIcon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';
import { formatCurrencyInput, parseCurrencyInput } from '../../lib/currency';
import { ConfirmSoftDeleteModal } from '../../components/cadastros/ConfirmSoftDeleteModal';
import { Button, Input, Select, Textarea, Drawer, EmptyState } from '../../components/ui';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  price_type: 'fixed' | 'starting_at';
  duration_minutes: number;
  category: string;
  commission_percentage: number | null;
  return_period_days: number | null;
  custom_reminder_template: string | null;
  is_active: boolean;
  display_order?: number;
}

const DEFAULT_REMINDER_TEMPLATE =
  'Olá, {cliente}! Já faz {dias} dias desde o seu último {servico} na barbearia. Que tal agendar seu retorno para manter o visual em dia? Acesse: {link}';

interface ServiceItemCardProps {
  service: Service;
  positionNumber?: number;
  isFirst?: boolean;
  isLast?: boolean;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onToggleStatus: (id: string, currentStatus: boolean) => void;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
}

const ServiceItemCard: React.FC<ServiceItemCardProps> = React.memo(
  ({ service, positionNumber, isFirst, isLast, onMoveUp, onMoveDown, onToggleStatus, onEdit, onDelete }) => {
    return (
      <div
        className="service-item-card bg-bg-secondary shadow-[0_0_0_0.3px_var(--color-text-primary)] rounded-md py-4 px-5 flex justify-between items-center gap-4 max-md:flex-col max-md:items-start max-md:py-2 max-md:px-[0.625rem] max-md:gap-[0.3rem]"
      >
        <div className="service-card-main-content flex items-center gap-4 flex-1 min-w-0 max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)_auto] max-md:items-start max-md:gap-[0.4rem] max-md:w-full">
          <div className="service-card-order-controls flex flex-col gap-1 shrink-0 max-md:flex-row max-md:gap-[2px]">
            <button
              type="button"
              onClick={() => onMoveUp && onMoveUp(service.id)}
              disabled={isFirst}
              className="btn-order-arrow flex items-center justify-center w-7 h-7 rounded-sm border-none shadow-[0_0_0_0.5px_var(--color-text-primary)] bg-bg-secondary text-text-primary font-bold cursor-pointer transition-all duration-150 ease-in p-0 hover:not-disabled:bg-brand-lightest hover:not-disabled:shadow-[0_0_0_0.8px_var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed max-md:w-6 max-md:h-6"
              title="Subir posição no cardápio"
              aria-label={`Subir serviço ${service.name}`}
            >
              <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown && onMoveDown(service.id)}
              disabled={isLast}
              className="btn-order-arrow flex items-center justify-center w-7 h-7 rounded-sm border-none shadow-[0_0_0_0.5px_var(--color-text-primary)] bg-bg-secondary text-text-primary font-bold cursor-pointer transition-all duration-150 ease-in p-0 hover:not-disabled:bg-brand-lightest hover:not-disabled:shadow-[0_0_0_0.8px_var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed max-md:w-6 max-md:h-6"
              title="Descer posição no cardápio"
              aria-label={`Descer serviço ${service.name}`}
            >
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
            </button>
          </div>

          <div className="service-card-info flex flex-col gap-1 flex-1 min-w-0 max-md:gap-[0.15rem]">
            <div className="service-name-row flex items-center gap-2 flex-wrap max-md:grid max-md:grid-cols-[minmax(0,1fr)] max-md:items-start max-md:gap-1">
              {positionNumber !== undefined && (
                <span
                  className="service-position-badge font-mono text-[11px] font-extrabold text-text-primary bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] px-[6px] py-[2px] rounded-sm shrink-0 max-md:hidden"
                  title="Posição de exibição para o cliente"
                >
                  #{positionNumber}
                </span>
              )}
              <h5 className="service-name text-base font-extrabold text-text-primary m-0 break-words max-md:text-[0.875rem] max-md:leading-[1.15] max-md:[overflow-wrap:anywhere] max-md:line-clamp-2 max-md:min-w-0">{service.name}</h5>
              {service.category && (
                <span className="service-category-badge text-[11px] font-bold text-text-primary bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] px-[6px] py-px rounded-sm max-md:hidden">
                  {service.category}
                </span>
              )}
            </div>

            {service.description && (
              <p className="service-description text-xs text-text-secondary m-0 leading-[1.35] max-md:hidden">{service.description}</p>
            )}

            <div className="service-meta-badges flex items-center gap-2 flex-wrap mt-[0.15rem] max-md:gap-[0.2rem] max-md:mt-[0.05rem]">
              <span className="meta-badge inline-flex items-center gap-[0.3rem] text-[11px] text-text-primary bg-bg-secondary px-[7px] py-[2px] rounded-sm shadow-[0_0_0_0.5px_var(--color-text-primary)] max-md:gap-[0.15rem] max-md:px-1 max-md:py-px max-md:text-[10px]">
                <HugeiconsIcon icon={Clock01Icon} size={12} />
                {service.duration_minutes || 40} min
              </span>
              {service.return_period_days && (
                <span className="meta-badge meta-badge--retorno inline-flex items-center gap-[0.3rem] text-[11px] text-text-primary bg-bg-secondary px-[7px] py-[2px] rounded-sm shadow-[0_0_0_0.5px_var(--color-text-primary)] max-md:gap-[0.15rem] max-md:px-1 max-md:py-px max-md:text-[10px]">
                  <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={12} />
                  Retorno: ~{service.return_period_days}d
                </span>
              )}
              {service.commission_percentage !== null && (
                <span className="meta-badge meta-badge--comm inline-flex items-center gap-[0.3rem] text-[11px] text-success bg-[rgba(54,179,126,0.08)] px-[7px] py-[2px] rounded-sm shadow-[0_0_0_0.5px_var(--color-text-primary)] max-md:gap-[0.15rem] max-md:px-1 max-md:py-px max-md:text-[10px]">
                  <HugeiconsIcon icon={BadgePercentIcon} size={12} />
                  Comissão: {service.commission_percentage}%
                </span>
              )}
            </div>
          </div>

          <div className="service-card-price flex flex-col items-end justify-center min-w-[100px] shrink-0 text-right max-md:min-w-0">
            {service.price_type === 'starting_at' && (
              <span className="price-type-tag text-[10px] text-text-secondary uppercase font-bold tracking-[0.05em]">A partir de</span>
            )}
            <span className="service-price-value font-mono text-[1.1rem] font-extrabold text-text-primary max-md:text-base">
              R$ {service.price.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        <div className="service-card-actions flex items-center gap-[0.85rem] shrink-0 max-md:w-full max-md:justify-between max-md:items-center max-md:pt-1 max-md:border-t max-md:border-border max-md:min-w-0">
          <div className="status-switch-wrapper flex items-center gap-[0.4rem]">
            <span className={`status-switch-label text-xs text-text-secondary font-semibold min-w-[44px] max-md:text-[11px] ${service.is_active ? 'status-switch-label--active text-success' : ''}`}>
              {service.is_active ? 'Ativo' : 'Inativo'}
            </span>
            <label className="switch relative inline-block w-[38px] h-[22px] shrink-0">
              <input
                type="checkbox"
                className="peer opacity-0 w-0 h-0"
                checked={service.is_active}
                onChange={() => onToggleStatus(service.id, service.is_active)}
              />
              <span className="slider absolute cursor-pointer inset-0 bg-border transition-[background-color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] rounded-[22px] before:content-[''] before:absolute before:h-4 before:w-4 before:left-[3px] before:bottom-[3px] before:bg-white before:transition-transform before:duration-200 before:ease-[cubic-bezier(0.4,0,0.2,1)] before:rounded-full before:shadow-[0_1px_3px_rgba(0,0,0,0.2)] peer-checked:bg-success peer-checked:before:translate-x-4" />
            </label>
          </div>

            <div className="service-card-action-btns flex items-center gap-2 max-md:gap-[0.35rem]">
              <Button
                type="button"
                size="xs"
                variant="outline"
                aria-label={`Editar ${service.name}`}
                onClick={() => onEdit(service)}
                leftIcon={<HugeiconsIcon icon={Edit01Icon} size={13} />}
              >
                Editar
              </Button>

              <Button
                type="button"
                size="xs"
                variant="danger-outline"
                aria-label={`Excluir ${service.name}`}
                onClick={() => onDelete(service)}
                leftIcon={<HugeiconsIcon icon={Delete02Icon} size={13} />}
                title="Excluir serviço (mantém histórico)"
              >
                Excluir
              </Button>
            </div>
        </div>
      </div>
    );
  }
);
ServiceItemCard.displayName = 'ServiceItemCard';

export const normalizeCategoryName = (cat?: string | null): string => {
  if (!cat || !cat.trim()) return 'Outro';
  const trimmed = cat.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

export const Servicos: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('Todos');
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState<'fixed' | 'starting_at'>('fixed');
  const [duration, setDuration] = useState(40);
  const [category, setCategory] = useState('Cabelo');
  const [commission, setCommission] = useState('');
  const [returnPeriodDays, setReturnPeriodDays] = useState<string>('20');
  const [reminderTemplate, setReminderTemplate] = useState(DEFAULT_REMINDER_TEMPLATE);
  const [isActive, setIsActive] = useState(true);

  const categories = useMemo(() => ['Cabelo', 'Barba', 'Sobrancelha', 'Combo', 'Outro'], []);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      const rawServices = (data || []) as Array<Service & { price_type?: 'fixed' | 'starting_at'; duration_minutes?: number }>;
      setServices(
        rawServices.map((s, idx) => ({
          ...s,
          category: normalizeCategoryName(s.category),
          price_type: s.price_type || 'fixed',
          duration_minutes: s.duration_minutes || 40,
          display_order: s.display_order ?? idx + 1,
        }))
      );
    } catch (error: any) {
      addToast('Não foi possível carregar o catálogo de serviços.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenant.tenantId, addToast]);

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('services')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', serviceToDelete.id)
        .eq('tenant_id', tenant.tenantId);

      if (error) throw error;
      addToast(`Serviço "${serviceToDelete.name}" excluído com sucesso. Histórico preservado.`, 'success');
      setServiceToDelete(null);
      fetchServices();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao excluir serviço.', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useGSAP(() => {
    if (!loading && services.length > 0) {
      gsap.fromTo(
        '.service-item-card',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
      );
    }
  }, [loading, services, filterCategory]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setPriceType('fixed');
    setDuration(40);
    setCategory('Cabelo');
    setCommission('');
    setReturnPeriodDays('20');
    setReminderTemplate(DEFAULT_REMINDER_TEMPLATE);
    setIsActive(true);
  }, []);

  const handleOpenCreateDrawer = useCallback(() => {
    resetForm();
    setIsDrawerOpen(true);
  }, [resetForm]);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    resetForm();
  }, [resetForm]);

  const handleEdit = useCallback((service: Service) => {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description || '');
    setPrice(formatCurrencyInput(service.price));
    setPriceType(service.price_type || 'fixed');
    setDuration(service.duration_minutes || 40);
    setCategory(normalizeCategoryName(service.category));
    setCommission(service.commission_percentage !== null ? service.commission_percentage.toString() : '');
    setReturnPeriodDays(service.return_period_days !== null ? service.return_period_days.toString() : '20');
    setReminderTemplate(service.custom_reminder_template || DEFAULT_REMINDER_TEMPLATE);
    setIsActive(service.is_active);
    setIsDrawerOpen(true);
  }, []);

  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setPrice(rawVal ? formatCurrencyInput(rawVal) : '');
  }, []);

  const insertTagIntoTemplate = useCallback((tag: string) => {
    setReminderTemplate((prev) => `${prev} ${tag}`);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseCurrencyInput(price);
    if (!name.trim() || parsedPrice <= 0) {
      addToast('Preencha os campos obrigatórios corretamente.', 'warning');
      return;
    }

    try {
      setSaving(true);
      const serviceData = {
        tenant_id: tenant.tenantId,
        name: name.trim(),
        description: description.trim() || null,
        price: parsedPrice,
        price_type: priceType,
        duration_minutes: duration,
        category: normalizeCategoryName(category),
        commission_percentage: commission ? parseFloat(commission) : null,
        return_period_days: parseInt(returnPeriodDays, 10),
        custom_reminder_template: reminderTemplate.trim() || null,
        is_active: isActive,
        display_order: editingId ? undefined : services.length + 1,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        await supabase.from('services').update(serviceData).eq('id', editingId).eq('tenant_id', tenant.tenantId);
        addToast('Serviço atualizado com sucesso!', 'success');
      } else {
        await supabase.from('services').insert([serviceData]);
        addToast('Serviço criado com sucesso!', 'success');
      }
      handleCloseDrawer();
      fetchServices();
    } catch (error: any) {
      addToast('Não foi possível salvar o serviço.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveService = useCallback(
    async (serviceId: string, direction: 'up' | 'down') => {
      const idx = services.findIndex((s) => s.id === serviceId);
      if (idx === -1) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= services.length) return;

      const newServices = [...services];
      const [moved] = newServices.splice(idx, 1);
      newServices.splice(targetIdx, 0, moved);
      const updated = newServices.map((s, i) => ({ ...s, display_order: i + 1 }));
      setServices(updated);

      try {
        const updatePromises = updated.map((s) =>
          supabase
            .from('services')
            .update({ display_order: s.display_order, updated_at: new Date().toISOString() })
            .eq('id', s.id)
            .eq('tenant_id', tenant.tenantId)
        );

        const results = await Promise.all(updatePromises);
        const hasError = results.some((r) => r.error);
        if (hasError) {
          throw new Error('Falha ao atualizar uma ou mais posições no banco.');
        }
        addToast('Ordem dos serviços atualizada com sucesso!', 'success');
      } catch (err) {
        console.error('Erro ao reordenar:', err);
        addToast('Erro ao salvar a nova ordem dos serviços.', 'error');
        fetchServices();
      }
    },
    [services, tenant.tenantId, addToast, fetchServices]
  );

  const toggleServiceStatus = useCallback(async (id: string, currentStatus: boolean) => {
    try {
      await supabase.from('services').update({ is_active: !currentStatus }).eq('id', id);
      fetchServices();
    } catch {
      addToast('Erro ao atualizar status.', 'error');
    }
  }, [addToast, fetchServices]);

  const availableCategories = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = ['Todos'];
    for (const s of services) {
      const norm = normalizeCategoryName(s.category);
      if (!seen.has(norm)) {
        seen.add(norm);
        list.push(norm);
      }
    }
    return list;
  }, [services]);

  const serviceIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    services.forEach((s, idx) => map.set(s.id, idx));
    return map;
  }, [services]);

  const displayedServices = useMemo(() => {
    if (filterCategory === 'Todos') return services;
    return services.filter((s) => normalizeCategoryName(s.category) === filterCategory);
  }, [services, filterCategory]);

  const previewMessage = useMemo(() => {
    return reminderTemplate
      .replace('{cliente}', 'Carlos')
      .replace('{servico}', name || 'Corte')
      .replace('{dias}', returnPeriodDays || '20')
      .replace('{link}', `https://app.navalhado.com.br/cliente/exemplo`);
  }, [reminderTemplate, name, returnPeriodDays]);

  return (
    <div className="services-page flex flex-col gap-5 w-full max-w-[1200px] mx-auto">
      <div className="services-header-intro flex items-center justify-between gap-4 flex-wrap">
        <div className="services-header-text flex-1 min-w-[260px]">
          <h2 className="text-xl font-extrabold text-text-primary tracking-[-0.02em] m-0 mb-1">Cardápio de serviços</h2>
          <p className="text-sm text-text-secondary m-0">Defina os cortes, barbas e combos, organize a ordem de exibição no link do cliente e configure mensagens automáticas de retorno.</p>
        </div>
        <Button
          type="button"
          variant="soft"
          onClick={handleOpenCreateDrawer}
          leftIcon={<HugeiconsIcon icon={PlusSignIcon} size={18} />}
        >
          Cadastrar serviço
        </Button>
      </div>

      <div className="services-control-bar flex items-center justify-between gap-4 flex-wrap pb-1">
        <div className="services-category-pills flex items-center gap-2 overflow-x-auto pb-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {availableCategories.map((cat) => {
            const isActivePill = filterCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`filter-pill inline-flex items-center gap-[0.4rem] px-[14px] py-[6px] rounded-full text-[13px] font-semibold cursor-pointer transition-all duration-150 ease-in whitespace-nowrap ${
                  isActivePill
                    ? 'filter-pill--active bg-warning-bg text-text-primary border-none shadow-[0_0_0_0.8px_var(--color-text-primary)]'
                    : 'bg-bg-secondary text-text-primary border border-border hover:border-text-primary hover:text-text-primary'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`filter-pill-count text-[11px] px-[6px] py-px rounded-[10px] text-text-primary font-bold ${
                    isActivePill ? 'bg-[rgba(45,35,30,0.12)]' : 'bg-[rgba(45,35,30,0.08)]'
                  }`}
                >
                  {cat === 'Todos' ? services.length : services.filter(s => (s.category || 'Geral') === cat).length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="services-list-wrapper card flex flex-col gap-5 bg-bg-secondary border border-border rounded-lg shadow-sm p-6 max-md:p-3">
        <div className="list-section-header flex items-center justify-between pb-[0.85rem]">
          <div className="list-title-row flex items-center gap-3">
            <div>
              <h3 className="text-base font-extrabold text-text-primary m-0">Ordem de exibição</h3>
              <p className="list-section-subtitle text-xs text-text-secondary m-0 mt-[0.2rem]">Use as setas para definir a prioridade no agendamento público.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner spinner--brand" /></div>
        ) : displayedServices.length === 0 ? (
          <EmptyState
            icon={<HugeiconsIcon icon={ScissorIcon} size={32} />}
            title="Nenhum serviço encontrado"
            description="Nenhum serviço cadastrado nesta categoria."
            action={
              <Button variant="primary" onClick={handleOpenCreateDrawer}>
                Cadastrar serviço
              </Button>
            }
          />
        ) : (
          <div className="services-items-grid flex flex-col gap-3 max-md:gap-2">
            {displayedServices.map((service) => {
              const index = serviceIndexMap.get(service.id) ?? 0;
              const isFirst = index === 0;
              const isLast = index === services.length - 1;
              const positionNumber = index + 1;

              return (
                <ServiceItemCard
                  key={service.id}
                  service={service}
                  positionNumber={positionNumber}
                  isFirst={isFirst}
                  isLast={isLast}
                  onMoveUp={() => handleMoveService(service.id, 'up')}
                  onMoveDown={() => handleMoveService(service.id, 'down')}
                  onToggleStatus={toggleServiceStatus}
                  onEdit={handleEdit}
                  onDelete={(srv) => setServiceToDelete(srv)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (SOFT DELETE) */}
      <ConfirmSoftDeleteModal
        isOpen={Boolean(serviceToDelete)}
        title="Excluir serviço"
        itemName={serviceToDelete?.name || ''}
        itemTypeLabel="o serviço"
        warningText="O histórico de agendamentos, atendimentos e comandas passadas será 100% preservado nos relatórios, mas este serviço não estará mais disponível para novos agendamentos."
        loading={saving}
        onConfirm={handleDeleteService}
        onClose={() => setServiceToDelete(null)}
      />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        title={editingId ? 'Editar serviço' : 'Cadastrar novo serviço'}
        width={520}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
          <Input
            label="Nome do serviço *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Select
              label="Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <Select
              label="Tipo de preço"
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as any)}
            >
              <option value="fixed">Fixo</option>
              <option value="starting_at">A partir de</option>
            </Select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Input
              label="Valor *"
              prefixText="R$"
              value={price}
              onChange={handlePriceChange}
              required
            />
            <Input
              label="Comissão (%)"
              type="number"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tempo estimado: <span className="duration-highlight text-brand-primary font-extrabold">{duration} min</span>
            </label>
            <input
              type="range"
              min="10"
              max="180"
              step="5"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="duration-slider accent-brand-primary cursor-pointer h-8 w-full"
            />
          </div>

          <div className="commercial-section bg-bg-primary border border-border rounded-md p-4 flex flex-col gap-3">
            <Input
              label="Dias para retorno"
              type="number"
              value={returnPeriodDays}
              onChange={(e) => setReturnPeriodDays(e.target.value)}
            />

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <div className="template-label-row flex items-center justify-between flex-wrap gap-2 mb-[0.35rem]">
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mensagem de lembrete
                </label>
                <div className="tag-chips-wrapper flex items-center gap-[0.35rem] flex-wrap">
                  {['{cliente}', '{servico}', '{dias}', '{link}'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTagIntoTemplate(tag)}
                      className="btn-tag-chip text-[10px] font-bold px-[6px] py-[2px] rounded-sm border border-border bg-bg-secondary text-brand-primary cursor-pointer transition-all duration-150 ease-in hover:bg-brand-primary hover:text-white hover:border-brand-primary"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                rows={3}
                value={reminderTemplate}
                onChange={(e) => setReminderTemplate(e.target.value)}
              />
            </div>

            <div className="whatsapp-preview-card bg-bg-secondary border border-border rounded-md px-4 py-[0.875rem] text-xs flex flex-col gap-[0.4rem]">
              <div className="whatsapp-preview-header flex items-center gap-[0.4rem] text-[11px] font-bold text-[#25D366]">
                <HugeiconsIcon icon={WhatsappIcon} size={14} />
                <span>Prévia no WhatsApp</span>
              </div>
              <p className="whatsapp-preview-text text-text-primary m-0 leading-[1.4] break-words">{previewMessage}</p>
            </div>
          </div>

          {editingId && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-primary)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Serviço ativo</span>
              <label className="switch relative inline-block w-[38px] h-[22px] shrink-0">
                <input
                  type="checkbox"
                  className="peer opacity-0 w-0 h-0"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="slider absolute cursor-pointer inset-0 bg-border transition-[background-color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] rounded-[22px] before:content-[''] before:absolute before:h-4 before:w-4 before:left-[3px] before:bottom-[3px] before:bg-white before:transition-transform before:duration-200 before:ease-[cubic-bezier(0.4,0,0.2,1)] before:rounded-full before:shadow-[0_1px_3px_rgba(0,0,0,0.2)] peer-checked:bg-success peer-checked:before:translate-x-4" />
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseDrawer}
              fullWidth
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              fullWidth
            >
              Salvar
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
