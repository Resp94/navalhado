import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  category: string;
  commission_percentage: number | null;
  is_active: boolean;
}

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
  const [duration, setDuration] = useState(30);
  const [category, setCategory] = useState('Cabelo');
  const [commission, setCommission] = useState('');
  const [isActive, setIsActive] = useState(true);

  const categories = ['Cabelo', 'Barba', 'Sobrancelha', 'Combo', 'Outro'];

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      addToast('Não foi possível carregar o catálogo de serviços.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [tenant.tenantId]);

  useGSAP(() => {
    if (!loading && services.length > 0) {
      gsap.fromTo('.service-item-card', 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' }
      );
    }
  }, [loading, services]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setDuration(30);
    setCategory('Cabelo');
    setCommission('');
    setIsActive(true);
  };

  const handleEdit = (service: Service) => {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description || '');
    setPrice(
      service.price.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setDuration(service.duration_minutes);
    setCategory(service.category);
    setCommission(service.commission_percentage !== null ? service.commission_percentage.toString() : '');
    setIsActive(service.is_active);
  };

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

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setPrice(digits ? formatPriceToBR(digits) : '');
  };
  // ── Fim helpers ──

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
        duration_minutes: duration,
        category,
        commission_percentage: commission ? parseFloat(commission) : null,
        is_active: isActive,
        updated_at: new Date().toISOString()
      };

      if (editingId) {
        // Atualizar
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingId)
          .eq('tenant_id', tenant.tenantId);

        if (error) throw error;
        addToast('Serviço atualizado com sucesso!', 'success');
      } else {
        // Inserir
        const { error } = await supabase
          .from('services')
          .insert([serviceData]);

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

  const toggleServiceStatus = async (id: string, currentStatus: boolean) => {
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
  };

  return (
    <div className="services-page">
      <div className="services-header-intro">
        <h2>Catálogo de Serviços</h2>
        <p>Cadastre e gerencie os cortes, barbas, tratamentos e combos da barbearia.</p>
      </div>

      <div className="services-grid">
        {/* Painel do Formulário */}
        <section className="form-section card">
          <h3>{editingId ? 'Editar Serviço' : 'Novo Serviço'}</h3>
          
          <form onSubmit={handleSubmit} className="service-form">
            <div className="form-group">
              <label htmlFor="service-name">Nome do Serviço</label>
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
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="service-price">Preço (R$)</label>
                <input 
                  id="service-price"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 50,00" 
                  value={price} 
                  onChange={handlePriceChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                Duração:{' '}
                <span className="duration-highlight">
                  {duration < 60
                    ? `${duration} minutos`
                    : duration % 60 === 0
                      ? `${duration / 60} ${duration === 60 ? 'hora' : 'horas'}`
                      : `${Math.floor(duration / 60)} ${Math.floor(duration / 60) === 1 ? 'hora' : 'horas'} e ${duration % 60} min`
                  }
                </span>
              </label>
              <div className="slider-container">
                <input 
                  type="range" 
                  min="5" 
                  max="180" 
                  step="5" 
                  value={duration} 
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="duration-slider"
                />
                <div className="slider-labels">
                  <span>5m</span>
                  <span>1h</span>
                  <span>2h</span>
                  <span>3h</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="service-commission">Comissão Específica % (Opcional)</label>
              <input 
                id="service-commission"
                type="number" 
                min="0" 
                max="100" 
                placeholder="Ex: 45 (Deixe em branco para usar a comissão padrão do barbeiro)" 
                value={commission} 
                onChange={(e) => setCommission(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="service-desc">Descrição</label>
              <textarea 
                id="service-desc"
                placeholder="Descreva detalhes do serviço que o cliente verá ao agendar..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {editingId && (
              <div className="form-group checkbox-group">
                <input 
                  type="checkbox" 
                  id="service-active" 
                  checked={isActive} 
                  onChange={(e) => setIsActive(e.target.checked)} 
                />
                <label htmlFor="service-active">Serviço Ativo para novos agendamentos</label>
              </div>
            )}

            <div className="form-actions">
              {editingId && (
                <button type="button" onClick={resetForm} className="btn btn--outline-secondary">
                  Cancelar
                </button>
              )}
              <button type="submit" disabled={saving} className="btn btn--primary">
                {saving ? <div className="spinner spinner--sm" /> : (editingId ? 'Salvar Alterações' : 'Adicionar Serviço')}
              </button>
            </div>
          </form>
        </section>

        {/* Tabela de Listagem */}
        <section className="list-section card">
          <h3>Lista de Serviços</h3>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" style={{ borderColor: 'var(--color-brand-primary)', borderTopColor: 'transparent' }} />
              <p>Carregando serviços...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum serviço cadastrado.</p>
              <span className="empty-desc">Cadastre o primeiro serviço no painel ao lado.</span>
            </div>
          ) : (
            <div className="services-list-container">
              {categories.map((cat) => {
                const catServices = services.filter(s => s.category === cat);
                if (catServices.length === 0) return null;

                return (
                  <div key={cat} className="category-group">
                    <h4 className="category-title">{cat}</h4>
                    <div className="services-items-grid">
                      {catServices.map((service) => (
                        <div key={service.id} className={`service-item-card ${!service.is_active ? 'service-item-card--inactive' : ''}`}>
                          <div className="service-item-main">
                            <div className="service-item-details">
                              <h5>{service.name}</h5>
                              {service.description && <p className="service-item-desc">{service.description}</p>}
                              <div className="service-item-badges">
                                <span className="badge badge--duration">
                                {service.duration_minutes < 60
                                  ? `${service.duration_minutes} min`
                                  : service.duration_minutes % 60 === 0
                                    ? `${service.duration_minutes / 60}h`
                                    : `${Math.floor(service.duration_minutes / 60)}h${service.duration_minutes % 60}`
                                }
                              </span>
                                {service.commission_percentage !== null && (
                                  <span className="badge badge--commission">Comissão: {service.commission_percentage}%</span>
                                )}
                              </div>
                            </div>
                            <div className="service-item-price">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)}
                            </div>
                          </div>

                          <div className="service-item-actions">
                            <button 
                              onClick={() => toggleServiceStatus(service.id, service.is_active)}
                              className={`btn-action ${service.is_active ? 'btn-action--deactivate' : 'btn-action--activate'}`}
                              title={service.is_active ? 'Desativar serviço' : 'Ativar serviço'}
                            >
                              {service.is_active ? 'Desativar' : 'Ativar'}
                            </button>
                            <button 
                              onClick={() => handleEdit(service)}
                              className="btn-action btn-action--edit"
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .services-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .services-header-intro h2 {
          font-size: var(--font-size-xl);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .services-header-intro p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .services-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .services-grid {
            grid-template-columns: 1fr;
          }
        }

        .card {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          box-shadow: var(--shadow-sm);
        }

        .card h3 {
          font-size: var(--font-size-lg);
          font-weight: 600;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 0.5rem;
        }

        .service-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-row .form-group {
          min-width: 0;
        }

        .form-row .form-group input,
        .form-row .form-group select {
          width: 100%;
          min-width: 0;
        }

        .form-group label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .form-group input[type="text"],
        .form-group input[type="number"],
        .form-group select,
        .form-group textarea {
          padding: 0.65rem 0.875rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background-color: rgba(255, 255, 255, 0.75);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.1);
        }

        .checkbox-group {
          flex-direction: row;
          align-items: center;
          gap: 0.5rem;
          margin: 0.5rem 0;
        }

        .checkbox-group label {
          text-transform: none;
          font-weight: 600;
          font-size: var(--font-size-sm);
        }

        .duration-highlight {
          color: var(--color-brand-primary);
          font-weight: 800;
        }

        .slider-container {
          padding: 0.5rem 0;
        }

        .duration-slider {
          width: 100%;
          accent-color: var(--color-brand-primary);
          cursor: pointer;
          height: 6px;
          border-radius: var(--radius-full);
          background: rgba(234, 222, 214, 0.8);
          outline: none;
          transition: all 0.3s ease;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: var(--color-text-secondary);
          margin-top: 0.25rem;
          font-weight: 600;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .btn--outline-secondary {
          background-color: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-weight: 600;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn--outline-secondary:hover {
          background-color: rgba(255, 255, 255, 0.5);
          transform: translateY(-1px);
        }

        .btn--primary {
          background-color: var(--color-brand-primary);
          color: white;
          border: none;
          font-weight: 700;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn--primary:hover {
          background-color: var(--color-brand-hover);
          transform: translateY(-1px);
        }

        .btn--primary:active {
          transform: scale(0.97);
        }

        .loading-state,
        .empty-state {
          padding: 4rem 1.5rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: var(--color-text-secondary);
          border: 1.5px dashed rgba(234, 222, 214, 0.8);
          border-radius: var(--radius-lg);
          background-color: rgba(255, 255, 255, 0.25);
        }

        .empty-desc {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .services-list-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .category-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .category-title {
          font-size: var(--font-size-sm);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-brand-primary);
          border-left: 3.5px solid var(--color-brand-primary);
          padding-left: 0.5rem;
          line-height: 1.2;
        }

        .services-items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .service-item-card {
          background-color: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(12px) saturate(120%);
          -webkit-backdrop-filter: blur(12px) saturate(120%);
          border: 1px solid rgba(234, 222, 214, 0.5);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1rem;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), var(--shadow-sm);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .service-item-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: rgba(217, 108, 0, 0.3);
        }

        .service-item-card--inactive {
          opacity: 0.65;
          border-style: dashed;
        }

        .service-item-main {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .service-item-details h5 {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.15rem;
        }

        .service-item-desc {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          line-height: 1.3;
          margin-bottom: 0.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .service-item-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .badge {
          font-size: 0.65rem;
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-sm);
          font-weight: 700;
        }

        .badge--duration {
          background-color: rgba(234, 222, 214, 0.6);
          color: var(--color-text-primary);
        }

        .badge--commission {
          background-color: rgba(254, 243, 199, 0.5);
          color: var(--color-warning);
          border: 1px solid rgba(217, 120, 6, 0.15);
        }

        .service-item-price {
          font-size: var(--font-size-sm);
          font-weight: 800;
          color: var(--color-brand-primary);
          white-space: nowrap;
        }

        .service-item-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          border-top: 1px solid rgba(234, 222, 214, 0.6);
          padding-top: 0.65rem;
        }

        .btn-action {
          background: none;
          border: none;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-action--edit {
          color: var(--color-brand-primary);
          background-color: rgba(217, 108, 0, 0.08);
          border: 1px solid rgba(217, 108, 0, 0.12);
        }

        .btn-action--edit:hover {
          background-color: var(--color-brand-primary);
          color: white;
          border-color: var(--color-brand-primary);
          transform: translateY(-1px);
        }

        .btn-action--deactivate {
          color: var(--color-error);
          background-color: rgba(240, 82, 82, 0.08);
          border: 1px solid rgba(240, 82, 82, 0.12);
        }

        .btn-action--deactivate:hover {
          background-color: var(--color-error);
          color: white;
          border-color: var(--color-error);
          transform: translateY(-1px);
        }

        .btn-action--activate {
          color: var(--color-success);
          background-color: rgba(14, 159, 110, 0.08);
          border: 1px solid rgba(14, 159, 110, 0.12);
        }

        .btn-action--activate:hover {
          background-color: var(--color-success);
          color: white;
          border-color: var(--color-success);
          transform: translateY(-1px);
        }

        .btn-action:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};
