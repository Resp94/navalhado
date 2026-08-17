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
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';

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
}

const DEFAULT_REMINDER_TEMPLATE =
  'Olá, {cliente}! Já se passaram {dias} dias desde o seu último {servico} na Barbearia. Que tal agendar seu retorno para manter o visual em dia? Acesse: {link}';

interface ServiceItemCardProps {
  service: Service;
  onToggleStatus: (id: string, currentStatus: boolean) => void;
  onEdit: (service: Service) => void;
}

const ServiceItemCard: React.FC<ServiceItemCardProps> = React.memo(
  ({ service, onToggleStatus, onEdit }) => {
    return (
      <div
        className={`service-item-card ${
          !service.is_active ? 'service-item-card--inactive' : ''
        }`}
      >
        {/* Informações Principais */}
        <div className="service-card-info">
          <h5 className="service-name">{service.name}</h5>

          {service.description && (
            <p className="service-description">{service.description}</p>
          )}

          <div className="service-meta-badges">
            <span className="meta-badge">
              <HugeiconsIcon icon={Clock01Icon} size={13} />
              {service.duration_minutes || 40} min
            </span>
            {service.return_period_days && (
              <span className="meta-badge meta-badge--retorno">
                <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={13} />
                Retorno: ~{service.return_period_days} dias
              </span>
            )}
            {service.commission_percentage !== null && (
              <span className="meta-badge meta-badge--comm">
                <HugeiconsIcon icon={BadgePercentIcon} size={13} />
                Comissão: {service.commission_percentage}%
              </span>
            )}
          </div>
        </div>

        {/* Bloco de Preço Alinhado em Coluna Dedicada */}
        <div className="service-card-price">
          {service.price_type === 'starting_at' && (
            <span className="price-type-tag">A partir de</span>
          )}
          <span className="service-price-value font-mono">
            R$ {service.price.toFixed(2).replace('.', ',')}
          </span>
        </div>

        {/* Controles de Ação e Status */}
        <div className="service-card-actions">
          <div className="status-switch-wrapper">
            <label
              className="switch"
              aria-label={`${service.is_active ? 'Desativar' : 'Ativar'} serviço ${service.name}`}
            >
              <input
                type="checkbox"
                checked={service.is_active}
                onChange={() => onToggleStatus(service.id, service.is_active)}
              />
              <span className="slider" />
            </label>
            <span
              className={`status-switch-label ${
                service.is_active ? 'status-switch-label--active' : ''
              }`}
            >
              {service.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </div>

          <button
            type="button"
            aria-label={`Editar configurações do serviço ${service.name}`}
            onClick={() => onEdit(service)}
            className="btn-action-edit"
          >
            <HugeiconsIcon icon={Edit01Icon} size={14} />
            Editar
          </button>
        </div>
      </div>
    );
  }
);
ServiceItemCard.displayName = 'ServiceItemCard';

export const Servicos: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados do Formulário
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState<'fixed' | 'starting_at'>('fixed');
  const [duration, setDuration] = useState(40); // 40 minutos padrão
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
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(
        (data || []).map((s: any) => ({
          ...s,
          price_type: s.price_type || 'fixed',
          duration_minutes: s.duration_minutes || 40,
        }))
      );
    } catch (error: any) {
      addToast('Não foi possível carregar o catálogo de serviços.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenant.tenantId, addToast]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useGSAP(() => {
    if (!loading && services.length > 0) {
      gsap.fromTo(
        '.service-item-card',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' }
      );
    }
  }, [loading, services]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setPriceType('fixed');
    setDuration(40); // 40 min padrão
    setCategory('Cabelo');
    setCommission('');
    setReturnPeriodDays('20');
    setReminderTemplate(DEFAULT_REMINDER_TEMPLATE);
    setIsActive(true);
  }, []);

  const handleEdit = useCallback((service: Service) => {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description || '');
    setPrice(
      service.price.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setPriceType(service.price_type || 'fixed');
    setDuration(service.duration_minutes || 40);
    setCategory(service.category);
    setCommission(
      service.commission_percentage !== null ? service.commission_percentage.toString() : ''
    );
    setReturnPeriodDays(
      service.return_period_days !== null && service.return_period_days !== undefined
        ? service.return_period_days.toString()
        : '20'
    );
    setReminderTemplate(service.custom_reminder_template || DEFAULT_REMINDER_TEMPLATE);
    setIsActive(service.is_active);
  }, []);

  // ── Helpers de formatação monetária (pt-BR) ──
  const formatPriceToBR = (digits: string): string => {
    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, -2);
    const centPart = padded.slice(-2);
    const intFormatted = parseInt(intPart, 10).toLocaleString('pt-BR');
    return `${intFormatted},${centPart}`;
  };

  const parsePriceFromBR = (formatted: string): number => {
    const normalized = formatted.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized);
  };

  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setPrice(digits ? formatPriceToBR(digits) : '');
  }, []);

  const insertTagIntoTemplate = useCallback((tag: string) => {
    setReminderTemplate((prev) => `${prev} ${tag}`);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('O nome do serviço é obrigatório.', 'warning');
      return;
    }
    if (!price || parsePriceFromBR(price) <= 0) {
      addToast('Informe um preço válido.', 'warning');
      return;
    }

    try {
      setSaving(true);
      const serviceData = {
        tenant_id: tenant.tenantId,
        name: name.trim(),
        description: description.trim() || null,
        price: parsePriceFromBR(price),
        price_type: priceType,
        duration_minutes: duration || 40,
        category,
        commission_percentage: commission ? parseFloat(commission) : null,
        return_period_days: returnPeriodDays ? parseInt(returnPeriodDays, 10) : 20,
        custom_reminder_template: reminderTemplate.trim() || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingId)
          .eq('tenant_id', tenant.tenantId);

        if (error) throw error;
        addToast('Serviço atualizado com sucesso!', 'success');
      } else {
        const { error } = await supabase.from('services').insert([serviceData]);

        if (error) throw error;
        addToast('Serviço criado com sucesso!', 'success');
      }

      resetForm();
      fetchServices();
    } catch (error: any) {
      console.error('Error saving service:', error);
      addToast('Não foi possível salvar o serviço.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleServiceStatus = useCallback(async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId);

      if (error) throw error;
      addToast(`Serviço ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`, 'success');
      fetchServices();
    } catch (error: any) {
      addToast('Erro ao atualizar status do serviço.', 'error');
    }
  }, [tenant.tenantId, addToast, fetchServices]);

  // Agrupamento memoizado de serviços por categoria
  const categorizedServices = useMemo(() => {
    return categories
      .map((cat) => ({
        category: cat,
        items: services.filter((s) => s.category === cat),
      }))
      .filter((g) => g.items.length > 0);
  }, [categories, services]);

  // Preview dinâmico da mensagem do WhatsApp enviada pela instância Uazapi oficial
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
        <span className="services-badge">
          Catálogo
        </span>
        <h2>Serviços e Parametrização Comercial</h2>
        <p>
          Configure os cortes, barbas, combos, tempos de retorno para reativação via WhatsApp (Uazapi) e tipo de preço.
        </p>
      </div>

      <div className="services-grid">
        {/* Painel do Formulário */}
        <section className="form-section card">
          <h3>{editingId ? 'Editar Serviço' : 'Novo Serviço'}</h3>

          <form onSubmit={handleSubmit} className="service-form">
            <div className="form-group">
              <label htmlFor="service-name">Nome do Serviço *</label>
              <input
                id="service-name"
                type="text"
                placeholder="Ex: Corte Degradê, Barboterapia"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="service-category">Categoria</label>
                <select
                  id="service-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="price-type-select">Tipo de Preço</label>
                <select
                  id="price-type-select"
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value as 'fixed' | 'starting_at')}
                >
                  <option value="fixed">Preço Fixo</option>
                  <option value="starting_at">A partir de</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="service-price">
                  {priceType === 'starting_at' ? 'Valor Inicial *' : 'Preço Fixo *'}
                </label>
                <div className="input-group input-group--prefix">
                  <span className="input-group__prefix">R$</span>
                  <input
                    id="service-price"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={price}
                    onChange={handlePriceChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="service-commission">
                  Comissão (%) <span className="label-optional">Opcional</span>
                </label>
                <div className="input-group">
                  <input
                    id="service-commission"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Ex: 45"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                  />
                  <span className="input-group__suffix">%</span>
                </div>
              </div>
            </div>

            {/* DURAÇÃO PADRÃO */}
            <div className="form-group">
              <label htmlFor="service-duration">
                Duração Padrão:{' '}
                <span className="duration-highlight">
                  {duration < 60
                    ? `${duration} minutos`
                    : duration % 60 === 0
                    ? `${duration / 60} ${duration === 60 ? 'hora' : 'horas'}`
                    : `${Math.floor(duration / 60)}h ${duration % 60}min`}
                </span>
              </label>
              <div className="slider-container">
                <input
                  id="service-duration"
                  type="range"
                  min="5"
                  max="180"
                  step="5"
                  value={duration}
                  aria-label="Duração padrão do serviço"
                  aria-valuemin={5}
                  aria-valuemax={180}
                  aria-valuenow={duration}
                  aria-valuetext={`${duration} minutos`}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                  className="duration-slider"
                />
                <div className="slider-labels" aria-hidden="true">
                  <span>5m</span>
                  <span>40m (padrão)</span>
                  <span>1h</span>
                  <span>2h</span>
                  <span>3h</span>
                </div>
              </div>
            </div>

            {/* SEÇÃO COMERCIAL: TEMPO DE RETORNO E TEMPLATE UAZAPI */}
            <div className="commercial-section">
              <div className="form-group">
                <label htmlFor="return-period-input">
                  Tempo Recomendado de Retorno (Dias)
                </label>
                <div className="input-group">
                  <input
                    id="return-period-input"
                    type="number"
                    min="1"
                    max="365"
                    placeholder="Ex: 20"
                    value={returnPeriodDays}
                    aria-describedby="return-period-helper"
                    onChange={(e) => setReturnPeriodDays(e.target.value)}
                  />
                  <span className="input-group__suffix">dias</span>
                </div>
                <span id="return-period-helper" className="input-helper">
                  Usado pelo motor de reativação para lembrar clientes quando estiver na hora de cortar.
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="template-textarea">Template de Mensagem de Retorno (WhatsApp Uazapi)</label>
                <div className="template-tags-helper">
                  <span>Inserir tag:</span>
                  <button
                    type="button"
                    onClick={() => insertTagIntoTemplate('{cliente}')}
                    className="tag-helper-btn"
                    aria-label="Inserir tag de nome do cliente no template"
                  >
                    {'{cliente}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTagIntoTemplate('{servico}')}
                    className="tag-helper-btn"
                    aria-label="Inserir tag de nome do serviço no template"
                  >
                    {'{servico}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTagIntoTemplate('{dias}')}
                    className="tag-helper-btn"
                    aria-label="Inserir tag de dias de retorno no template"
                  >
                    {'{dias}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTagIntoTemplate('{link}')}
                    className="tag-helper-btn"
                    aria-label="Inserir tag de link de agendamento no template"
                  >
                    {'{link}'}
                  </button>
                </div>
                <textarea
                  id="template-textarea"
                  rows={3}
                  value={reminderTemplate}
                  onChange={(e) => setReminderTemplate(e.target.value)}
                  className="form-control"
                  placeholder="Mensagem disparada pela instância conectada da barbearia..."
                />
              </div>

              {/* PREVIEW DA MENSAGEM */}
              <div className="whatsapp-preview-card">
                <div className="whatsapp-preview-header">
                  <HugeiconsIcon icon={WhatsappIcon} size={15} />
                  <span>Prévia do WhatsApp (Instância Conectada)</span>
                </div>
                <p className="whatsapp-preview-text">{previewMessage}</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="service-desc">Descrição do Serviço</label>
              <textarea
                id="service-desc"
                placeholder="Descreva detalhes do serviço que o cliente verá ao agendar..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {editingId && (
              <div className="form-group form-switch-group">
                <label htmlFor="service-active" className="switch-text-label">
                  Serviço ativo para novos agendamentos
                </label>
                <label className="switch" aria-label="Status do serviço">
                  <input
                    type="checkbox"
                    id="service-active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
            )}

            <div className="form-actions">
              {editingId && (
                <button type="button" onClick={resetForm} className="btn btn--outline-secondary">
                  <HugeiconsIcon icon={Cancel01Icon} size={16} />
                  Cancelar
                </button>
              )}
              <button type="submit" disabled={saving} className="btn btn--primary">
                {saving ? (
                  <div className="spinner spinner--sm" />
                ) : editingId ? (
                  <>
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                    Salvar Alterações
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={PlusSignIcon} size={16} />
                    Adicionar Serviço
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Tabela de Listagem */}
        <section className="list-section card">
          <h3>Lista de Serviços</h3>

          {loading ? (
            <div className="loading-state" role="status" aria-live="polite">
              <div className="spinner spinner--brand" />
              <p>Carregando serviços...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum serviço cadastrado.</p>
              <span className="empty-desc">Cadastre o primeiro serviço no painel ao lado.</span>
            </div>
          ) : (
            <div className="services-list-container" aria-busy={loading}>
              {categorizedServices.map(({ category: cat, items }) => (
                <div key={cat} className="category-group">
                  <h4 className="category-title">{cat}</h4>
                  <div className="services-items-grid">
                    {items.map((service) => (
                      <ServiceItemCard
                        key={service.id}
                        service={service}
                        onToggleStatus={toggleServiceStatus}
                        onEdit={handleEdit}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .services-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .services-badge {
          display: inline-block;
          background: rgba(217, 108, 0, 0.12);
          color: var(--color-brand-primary);
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          padding: 4px 12px;
          border-radius: var(--radius-full);
          margin-bottom: 0.5rem;
        }

        .services-header-intro h2 {
          font-size: var(--font-size-xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
        }

        .services-header-intro p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .services-grid {
          display: grid;
          grid-template-columns: 440px 1fr;
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .services-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .card {
            padding: 1.15rem;
          }

          .form-row {
            grid-template-columns: 1fr !important;
          }

          .service-item-card {
            flex-direction: column;
            align-items: stretch;
            gap: 0.85rem;
          }

          .service-card-footer {
            justify-content: space-between;
            width: 100%;
            padding-top: 0.75rem;
            border-top: 1px solid var(--color-border);
          }
        }

        .card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          box-shadow: var(--shadow-sm);
        }

        .form-section h3, .list-section h3 {
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 1.25rem;
        }

        .service-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-group label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .label-optional {
          font-size: 10px;
          text-transform: none;
          color: var(--color-text-secondary);
          opacity: 0.8;
          font-weight: 400;
        }

        .form-group input, .form-group select, .form-group textarea {
          padding: 0.7rem 0.85rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          outline: none;
          transition: all 0.2s ease;
        }

        @media (max-width: 768px) {
          .form-group input, .form-group select, .form-group textarea {
            font-size: 16px; /* Evita auto-zoom do Safari iOS */
          }
        }

        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }

        .duration-highlight {
          color: var(--color-brand-primary);
          font-weight: 800;
        }

        .slider-container {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .duration-slider {
          accent-color: var(--color-brand-primary);
          cursor: pointer;
          height: 32px;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .commercial-section {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .template-tags-helper {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          font-size: 11px;
          color: var(--color-text-secondary);
          margin-bottom: 0.25rem;
        }

        .tag-helper-btn {
          background: rgba(217, 108, 0, 0.1);
          border: 1px solid rgba(217, 108, 0, 0.25);
          border-radius: var(--radius-sm);
          color: var(--color-brand-primary);
          font-size: 12px;
          font-weight: 700;
          padding: 6px 10px;
          min-height: 32px;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tag-helper-btn:hover {
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
        }

        .whatsapp-preview-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.875rem 1rem;
          font-size: 12px;
        }

        .whatsapp-preview-header {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-success);
          margin-bottom: 0.35rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .whatsapp-preview-text {
          color: var(--color-text-primary);
          margin: 0;
          line-height: 1.4;
          word-break: break-word;
        }

        .input-helper {
          font-size: 11px;
          color: var(--color-text-secondary);
          line-height: 1.3;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-group input {
          width: 100%;
          padding-right: 2.5rem;
        }

        .input-group__suffix {
          position: absolute;
          right: 0.75rem;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: 700;
        }

        .form-switch-group {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
        }

        .switch-text-label {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-primary);
          cursor: pointer;
        }

        .form-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .btn--outline-secondary {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          border-radius: var(--radius-full);
          padding: 0.75rem 1.25rem;
          font-weight: 600;
          font-size: var(--font-size-sm);
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn--outline-secondary:hover {
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          border-color: var(--color-text-secondary);
        }

        .services-list-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .category-title {
          font-size: var(--font-size-xs);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-brand-primary);
          margin-bottom: 0.75rem;
          padding-bottom: 0.35rem;
          border-bottom: 1px solid var(--color-border);
        }

        .services-items-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .service-item-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s ease;
        }

        .service-item-card:hover {
          border-color: rgba(217, 108, 0, 0.35);
          box-shadow: var(--shadow-sm);
        }

        .service-item-card--inactive {
          opacity: 0.6;
        }

        .service-card-main {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          flex: 1;
        }

        .service-info-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .service-info-header h5 {
          font-size: var(--font-size-base);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
          word-break: break-word;
        }

        .service-price-block {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .price-type-tag {
          font-size: 10px;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .service-price {
          font-size: var(--font-size-base);
          font-weight: 800;
          color: var(--color-brand-primary);
        }

        .service-description {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0;
          word-break: break-word;
        }

        .service-meta-badges {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.25rem;
        }

        .meta-badge {
          font-size: 11px;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          padding: 3px 10px;
          border-radius: var(--radius-full);
          color: var(--color-text-secondary);
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }

        .meta-badge--retorno {
          background: rgba(217, 108, 0, 0.12);
          border-color: rgba(217, 108, 0, 0.25);
          color: var(--color-brand-primary);
        }

        .meta-badge--comm {
          background: var(--color-success-bg, rgba(14, 159, 110, 0.12));
          border-color: rgba(14, 159, 110, 0.25);
          color: var(--color-success);
        }

        .service-card-footer {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex-shrink: 0;
        }

        /* Switch Toggle Component */
        .status-switch-wrapper {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-switch-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          transition: color 0.2s ease;
          min-width: 44px;
        }

        .status-switch-label--active {
          color: var(--color-success);
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 38px;
          height: 22px;
          flex-shrink: 0;
        }

        .switch input {
          width: 0;
          height: 0;
          opacity: 0;
          position: absolute;
        }

        .slider {
          position: absolute;
          inset: 0;
          cursor: pointer;
          border-radius: var(--radius-full);
          background-color: var(--color-border);
          transition: background-color 0.25s ease, box-shadow 0.25s ease;
        }

        .slider::before {
          position: absolute;
          bottom: 3px;
          left: 3px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background-color: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          content: '';
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .switch input:checked + .slider {
          background-color: var(--color-success);
        }

        .switch input:focus-visible + .slider {
          box-shadow: 0 0 0 3px rgba(14, 159, 110, 0.25);
        }

        .switch input:checked + .slider::before {
          transform: translateX(16px);
        }

        .btn-action-edit {
          font-size: 12px;
          font-weight: 700;
          padding: 0.5rem 0.95rem;
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          border-radius: var(--radius-md);
          background: rgba(217, 108, 0, 0.08);
          border: 1px solid rgba(217, 108, 0, 0.25);
          color: var(--color-brand-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-action-edit:hover {
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
        }

        .spinner--brand {
          border-color: rgba(217, 108, 0, 0.2);
          border-top-color: var(--color-brand-primary);
        }
      `}</style>
    </div>
  );
};
