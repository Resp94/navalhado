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
        className={`service-item-card ${
          !service.is_active ? 'service-item-card--inactive' : ''
        }`}
      >
        <div className="service-card-main-content">
          <div className="service-card-order-controls">
            <button
              type="button"
              onClick={() => onMoveUp && onMoveUp(service.id)}
              disabled={isFirst}
              className="btn-order-arrow"
              title="Subir posição no cardápio"
              aria-label={`Subir serviço ${service.name}`}
            >
              <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown && onMoveDown(service.id)}
              disabled={isLast}
              className="btn-order-arrow"
              title="Descer posição no cardápio"
              aria-label={`Descer serviço ${service.name}`}
            >
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
            </button>
          </div>

          <div className="service-card-info">
            <div className="service-name-row">
              {positionNumber !== undefined && (
                <span
                  className="service-position-badge service-position-badge--mobile-secondary font-mono"
                  title="Posição de exibição para o cliente"
                >
                  #{positionNumber}
                </span>
              )}
              <h5 className="service-name">{service.name}</h5>
              {service.category && (
                <span className="service-category-badge service-category-badge--mobile-secondary">
                  {service.category}
                </span>
              )}
            </div>

            {service.description && (
              <p className="service-description">{service.description}</p>
            )}

            <div className="service-meta-badges">
              <span className="meta-badge">
                <HugeiconsIcon icon={Clock01Icon} size={12} />
                {service.duration_minutes || 40} min
              </span>
              {service.return_period_days && (
                <span className="meta-badge meta-badge--retorno">
                  <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={12} />
                  Retorno: ~{service.return_period_days}d
                </span>
              )}
              {service.commission_percentage !== null && (
                <span className="meta-badge meta-badge--comm">
                  <HugeiconsIcon icon={BadgePercentIcon} size={12} />
                  Comissão: {service.commission_percentage}%
                </span>
              )}
            </div>
          </div>

          <div className="service-card-price">
            {service.price_type === 'starting_at' && (
              <span className="price-type-tag">A partir de</span>
            )}
            <span className="service-price-value font-mono">
              R$ {service.price.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        <div className="service-card-actions">
          <div className="status-switch-wrapper">
            <span className={`status-switch-label ${service.is_active ? 'status-switch-label--active' : ''}`}>
              {service.is_active ? 'Ativo' : 'Inativo'}
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={service.is_active}
                onChange={() => onToggleStatus(service.id, service.is_active)}
              />
              <span className="slider" />
            </label>
          </div>

            <div className="service-card-action-btns">
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
    <div className="services-page">
      <div className="services-header-intro">
        <div className="services-header-text">
          <h2>Cardápio de serviços</h2>
          <p>Defina os cortes, barbas e combos, organize a ordem de exibição no link do cliente e configure mensagens automáticas de retorno.</p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleOpenCreateDrawer}
          leftIcon={<HugeiconsIcon icon={PlusSignIcon} size={18} />}
        >
          Cadastrar serviço
        </Button>
      </div>

      <div className="services-control-bar">
        <div className="services-category-pills">
          {availableCategories.map((cat) => (
            <button key={cat} type="button" onClick={() => setFilterCategory(cat)} className={`filter-pill ${filterCategory === cat ? 'filter-pill--active' : ''}`}>
              <span>{cat}</span>
              <span className="filter-pill-count">{cat === 'Todos' ? services.length : services.filter(s => (s.category || 'Geral') === cat).length}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="services-list-wrapper card">
        <div className="list-section-header">
          <div className="list-title-row">
            <div className="icon-badge">
              <HugeiconsIcon icon={ScissorIcon} size={18} />
            </div>
            <div>
              <h3>Ordem de exibição</h3>
              <p className="list-section-subtitle">Use as setas para definir a prioridade no agendamento público.</p>
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
          <div className="services-items-grid">
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
              Tempo estimado: <span className="duration-highlight">{duration} min</span>
            </label>
            <input
              type="range"
              min="10"
              max="180"
              step="5"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="duration-slider"
            />
          </div>

          <div className="commercial-section">
            <Input
              label="Dias para retorno"
              type="number"
              value={returnPeriodDays}
              onChange={(e) => setReturnPeriodDays(e.target.value)}
            />

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <div className="template-label-row">
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mensagem de lembrete
                </label>
                <div className="tag-chips-wrapper">
                  {['{cliente}', '{servico}', '{dias}', '{link}'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTagIntoTemplate(tag)}
                      className="btn-tag-chip"
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

            <div className="whatsapp-preview-card">
              <div className="whatsapp-preview-header">
                <HugeiconsIcon icon={WhatsappIcon} size={14} />
                <span>Prévia no WhatsApp</span>
              </div>
              <p className="whatsapp-preview-text">{previewMessage}</p>
            </div>
          </div>

          {editingId && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-primary)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Serviço ativo</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="slider" />
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

       <style>{`
        .services-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }

        .services-header-intro {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .services-header-text {
          flex: 1;
          min-width: 260px;
        }

        .services-header-intro h2 {
          font-size: var(--font-size-xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
          margin: 0 0 0.25rem 0;
        }

        .services-header-intro p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin: 0;
        }

        .btn-create-service-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.35rem;
          font-weight: 700;
          font-size: var(--font-size-sm);
          border-radius: var(--radius-full, 9999px);
          box-shadow: 0 4px 14px rgba(217, 108, 0, 0.25);
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .services-control-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          padding-bottom: 0.25rem;
        }

        .services-category-pills {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 2px;
        }

        .filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 6px 14px;
          border-radius: var(--radius-full, 9999px);
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          color: var(--color-text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .filter-pill:hover {
          border-color: var(--color-brand-primary);
          color: var(--color-text-primary);
        }

        .filter-pill--active {
          background: var(--color-brand-primary);
          color: #ffffff;
          border-color: var(--color-brand-primary);
          box-shadow: 0 3px 10px rgba(217, 108, 0, 0.2);
        }

        .filter-pill-count {
          font-size: 11px;
          padding: 1px 6px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.15);
          font-weight: 700;
        }

        .filter-pill--active .filter-pill-count {
          background: rgba(255, 255, 255, 0.25);
          color: #ffffff;
        }

        .services-stats-summary {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .services-list-wrapper {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          box-shadow: var(--shadow-sm);
        }

        .list-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.85rem;
          border-bottom: 1px solid var(--color-border);
        }

        .list-title-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .icon-badge {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: rgba(217, 108, 0, 0.1);
          color: var(--color-brand-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .list-section-header h3 {
          font-size: var(--font-size-base);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
        }

        .list-section-subtitle {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0.2rem 0 0 0;
        }

        .services-items-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .service-item-card {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .service-card-main-content {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
          min-width: 0;
        }

        .service-card-action-btns {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .service-card-order-controls {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex-shrink: 0;
        }

        .btn-order-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          padding: 0;
        }

        .btn-order-arrow:hover:not(:disabled) {
          background: var(--color-brand-primary);
          color: #ffffff;
          border-color: var(--color-brand-primary);
        }

        .btn-order-arrow:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .service-card-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
          min-width: 0;
        }

        .service-name-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .service-position-badge {
          font-size: 11px;
          font-weight: 800;
          color: var(--color-brand-primary);
          background: rgba(217, 108, 0, 0.1);
          border: 1px solid rgba(217, 108, 0, 0.2);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }

        .service-category-badge {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-secondary);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          padding: 1px 6px;
          border-radius: var(--radius-sm);
        }

        .service-name {
          font-size: var(--font-size-base);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
          word-break: break-word;
        }

        .service-description {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.35;
        }

        .service-meta-badges {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.15rem;
        }

        .meta-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 11px;
          color: var(--color-text-secondary);
          background: var(--color-bg-secondary);
          padding: 2px 7px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
        }

        .meta-badge--retorno {
          color: var(--color-brand-primary);
          background: rgba(217, 108, 0, 0.08);
          border-color: rgba(217, 108, 0, 0.2);
        }

        .meta-badge--comm {
          color: var(--color-success);
          background: rgba(54, 179, 126, 0.08);
          border-color: rgba(54, 179, 126, 0.2);
        }

        .service-card-price {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          min-width: 100px;
          flex-shrink: 0;
          text-align: right;
        }

        .price-type-tag {
          font-size: 10px;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .service-price-value {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--color-brand-primary);
        }

        .service-card-actions {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex-shrink: 0;
        }

        .status-switch-wrapper {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .status-switch-label {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: 600;
          min-width: 44px;
        }

        .status-switch-label--active {
          color: var(--color-success);
        }

        .btn-action-edit {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 6px 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-edit:hover {
          border-color: var(--color-brand-primary);
          color: var(--color-brand-primary);
        }

        .btn-action-delete {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 6px 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-delete:hover {
          border-color: #ef4444;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
        }

        /* MODAL DE EXCLUSÃO (SOFT DELETE) */
        .service-delete-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          animation: fadeIn 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .service-delete-modal-card {
          width: 100%;
          max-width: 460px;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.75rem;
          box-shadow: var(--shadow-xl);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1rem;
        }

        .service-delete-icon-badge {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .service-delete-title {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
        }

        .service-delete-text {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin: 0;
        }

        .service-delete-warning-box {
          background: rgba(217, 108, 0, 0.08);
          border: 1px solid rgba(217, 108, 0, 0.2);
          border-radius: var(--radius-md);
          padding: 0.85rem;
          font-size: 12px;
          color: var(--color-text-secondary);
          text-align: left;
          line-height: 1.45;
        }

        .service-delete-actions {
          display: flex;
          width: 100%;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .service-delete-actions button {
          flex: 1;
        }

        .btn--danger-delete {
          background: #ef4444;
          color: #ffffff;
          border: none;
          font-weight: 700;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn--danger-delete:hover:not(:disabled) {
          background: #dc2626;
        }

        .btn--danger-delete:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* DURATION SLIDER & TEMPLATE PREVIEW */
        .duration-highlight {
          color: var(--color-brand-primary);
          font-weight: 800;
        }

        .duration-slider {
          accent-color: var(--color-brand-primary);
          cursor: pointer;
          height: 32px;
          width: 100%;
        }

        .commercial-section {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .template-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
        }

        .tag-chips-wrapper {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-wrap: wrap;
        }

        .btn-tag-chip {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          color: var(--color-brand-primary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-tag-chip:hover {
          background: var(--color-brand-primary);
          color: #ffffff;
          border-color: var(--color-brand-primary);
        }

        .whatsapp-preview-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.875rem 1rem;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .whatsapp-preview-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 11px;
          font-weight: 700;
          color: #25D366;
        }

        .whatsapp-preview-text {
          color: var(--color-text-primary);
          margin: 0;
          line-height: 1.4;
          word-break: break-word;
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 38px;
          height: 22px;
          flex-shrink: 0;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--color-border);
          transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 22px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        input:checked + .slider {
          background-color: var(--color-success);
        }

        input:checked + .slider:before {
          transform: translateX(16px);
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* RESPONSIVIDADE MOBILE */
        @media (max-width: 768px) {
          .services-list-wrapper.card {
            padding: 0.75rem;
          }

          .services-items-grid {
            gap: 0.5rem;
          }

          .service-item-card {
            flex-direction: column;
            align-items: flex-start;
            padding: 0.5rem 0.625rem;
            gap: 0.3rem;
          }

          .service-card-main-content {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: flex-start;
            gap: 0.4rem;
            width: 100%;
            min-width: 0;
          }

          .service-card-info {
            flex: 1;
            min-width: 0;
            gap: 0.15rem;
          }

          .service-name-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            align-items: start;
            gap: 0.25rem;
            flex-wrap: nowrap;
          }

          .service-position-badge--mobile-secondary,
          .service-category-badge--mobile-secondary {
            display: none;
          }

          .service-name {
            grid-column: 1;
            min-width: 0;
          }

          .service-card-order-controls {
            flex-direction: row;
            gap: 2px;
          }

          .btn-order-arrow {
            width: 24px;
            height: 24px;
          }

          .service-name {
            font-size: 0.875rem;
            line-height: 1.15;
            overflow-wrap: anywhere;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .service-description {
            display: none;
          }

          .service-meta-badges {
            gap: 0.2rem;
            margin-top: 0.05rem;
          }

          .meta-badge {
            gap: 0.15rem;
            padding: 1px 4px;
            font-size: 10px;
          }

          .service-card-price {
            align-items: flex-end;
            text-align: right;
            min-width: auto;
            flex-shrink: 0;
          }

          .service-price-value {
            font-size: 1rem;
          }

          .service-card-actions {
            width: 100%;
            justify-content: space-between;
            align-items: center;
            padding-top: 0.25rem;
            border-top: 1px solid var(--color-border);
            min-width: 0;
          }

          .service-card-action-btns {
            display: flex;
            align-items: center;
            gap: 0.35rem;
          }

          .btn-action-edit,
          .btn-action-delete {
            padding: 3px 7px;
            font-size: 11px;
            height: 28px;
          }

          .status-switch-label {
            font-size: 11px;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
