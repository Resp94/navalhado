import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  ScissorIcon, 
  Delete02Icon, 
  Add01Icon, 
  CirclePlusIcon,
  ArrowRight01Icon, 
  ArrowLeft01Icon,
  Time01Icon
} from '@hugeicons/core-free-icons';
import type { OnboardingService } from './types';

interface StepServicesProps {
  services: OnboardingService[];
  baseCutPrice: number;
  onAddService: (service: Omit<OnboardingService, 'id'>) => void;
  onRemoveService: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const TEMPLATE_SERVICES = [
  { name: 'Corte Tradicional', priceRatio: 1.0, durationMinutes: 30, category: 'cabelo' },
  { name: 'Barba', priceRatio: 0.75, durationMinutes: 30, category: 'barba' },
  { name: 'Corte e Barba', priceRatio: 1.6, durationMinutes: 45, category: 'combo' },
  { name: 'Pezinho e Acabamento', priceRatio: 0.4, durationMinutes: 15, category: 'cabelo' },
];

const DURATION_OPTIONS = [
  15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300
];

export const StepServices: React.FC<StepServicesProps> = ({
  services,
  baseCutPrice,
  onAddService,
  onRemoveService,
  onNext,
  onBack,
}) => {
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customDuration, setCustomDuration] = useState('30');
  const [customCategory, setCustomCategory] = useState('cabelo');
  const [showCustomForm, setShowCustomForm] = useState(false);

  const effectiveBasePrice = baseCutPrice > 0 ? baseCutPrice : 35;

  const handleAddTemplate = (tpl: typeof TEMPLATE_SERVICES[0]) => {
    const calculatedPrice = Math.round(effectiveBasePrice * tpl.priceRatio);
    onAddService({
      name: tpl.name,
      price: calculatedPrice,
      durationMinutes: tpl.durationMinutes,
      category: tpl.category,
    });
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customPrice) return;

    const numericPrice = parseFloat(customPrice.replace(',', '.'));
    if (isNaN(numericPrice) || numericPrice <= 0) return;

    onAddService({
      name: customName.trim(),
      price: numericPrice,
      durationMinutes: parseInt(customDuration, 10),
      category: customCategory,
    });

    setCustomName('');
    setCustomPrice('');
    setShowCustomForm(false);
  };

  const isTemplateAdded = (tplName: string) => {
    return services.some((s) => s.name.toLowerCase() === tplName.toLowerCase());
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="onboarding-step" data-testid="step-services">
      <div className="onboarding-step-header">
        <span className="step-pill">Etapa 3 de 4 • Cardápio de Serviços</span>
        <h2>Monte o seu cardápio de serviços</h2>
        <p className="onboarding-step-subtitle">
          O <strong>Corte Tradicional</strong> já está na sua lista. Adicione outros serviços comuns em 1 clique ou cadastre novos itens.
        </p>
      </div>

      {/* Sugestões Rápidas em 1 Clique */}
      <div className="services-templates-section">
        <label className="section-small-title">
          Sugestões rápidas para adicionar:
        </label>
        <div className="template-chips-grid">
          {TEMPLATE_SERVICES.map((tpl) => {
            const added = isTemplateAdded(tpl.name);
            const calculatedPrice = Math.round(effectiveBasePrice * tpl.priceRatio);

            return (
              <button
                key={tpl.name}
                type="button"
                className={`template-chip ${added ? 'template-chip--added' : ''}`}
                onClick={() => !added && handleAddTemplate(tpl)}
                disabled={added}
              >
                <div className="template-chip__left">
                  <span className="template-chip__icon">
                    <HugeiconsIcon icon={ScissorIcon} size={18} />
                  </span>
                  <div className="template-chip__text">
                    <span className="template-chip__title">{tpl.name}</span>
                    <span className="template-chip__meta">
                      {formatCurrency(calculatedPrice)} • {tpl.durationMinutes} min
                    </span>
                  </div>
                </div>
                <span className="template-chip__action">
                  {added ? 'Adicionado' : '+ Adicionar'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Serviços Cadastrados */}
      <div className="services-list-container">
        <div className="services-list-header">
          <h3 className="services-list-title">
            Serviços no Cardápio ({services.length})
          </h3>
          {!showCustomForm && (
            <button
              type="button"
              className="btn-outline-primary btn-sm btn-align-icon"
              onClick={() => setShowCustomForm(true)}
            >
              <HugeiconsIcon icon={CirclePlusIcon} size={16} />
              <span>Novo Serviço Personalizado</span>
            </button>
          )}
        </div>

        {services.length === 0 ? (
          <div className="empty-services-alert">
            <HugeiconsIcon icon={ScissorIcon} size={28} />
            <p>Seu cardápio ainda está vazio. Clique em uma das sugestões acima para começar.</p>
          </div>
        ) : (
          <div className="services-table-wrapper">
            <table className="services-table">
              <thead>
                <tr>
                  <th>Serviço</th>
                  <th>Categoria</th>
                  <th>Duração</th>
                  <th>Preço</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong className="service-row-name">{s.name}</strong>
                    </td>
                    <td>
                      <span className="service-category-badge">
                        {s.category === 'cabelo' ? 'Cabelo' : s.category === 'barba' ? 'Barba' : s.category === 'combo' ? 'Combo' : 'Outro'}
                      </span>
                    </td>
                    <td>
                      <span className="service-duration-badge">
                        <HugeiconsIcon icon={Time01Icon} size={12} />
                        <span>{s.durationMinutes} min</span>
                      </span>
                    </td>
                    <td>
                      <strong className="service-price-value">{formatCurrency(s.price)}</strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-icon-delete"
                        onClick={() => onRemoveService(s.id)}
                        title="Remover serviço"
                        aria-label={`Remover ${s.name}`}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulário de Serviço Customizado */}
      {showCustomForm && (
        <form className="custom-service-form" onSubmit={handleAddCustom}>
          <div className="custom-service-header">
            <h4>Cadastrar Novo Serviço</h4>
            <button
              type="button"
              className="btn-link-sm"
              onClick={() => setShowCustomForm(false)}
            >
              Fechar
            </button>
          </div>

          <div className="custom-service-grid">
            <div className="form-group form-group--half">
              <label className="form-label" htmlFor="custom-service-name">Nome do Serviço</label>
              <input
                id="custom-service-name"
                type="text"
                className="form-input"
                placeholder="Ex: Hidratação, Luzes, Platinado"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group form-group--half">
              <label className="form-label" htmlFor="custom-service-price">Preço (R$)</label>
              <input
                id="custom-service-price"
                type="text"
                className="form-input"
                placeholder="Ex: 50,00"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                required
              />
            </div>

            <div className="form-group form-group--half">
              <label className="form-label" htmlFor="custom-service-duration">Duração do Atendimento</label>
              <select
                id="custom-service-duration"
                className="form-select"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
              >
                {DURATION_OPTIONS.map((mins) => (
                  <option key={mins} value={mins}>
                    {mins} minutos {mins >= 60 ? `(${mins / 60}h${mins % 60 ? `${mins % 60}m` : ''})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group form-group--half">
              <label className="form-label" htmlFor="custom-service-category">Categoria</label>
              <select
                id="custom-service-category"
                className="form-select"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              >
                <option value="cabelo">Cabelo</option>
                <option value="barba">Barba</option>
                <option value="combo">Combo</option>
                <option value="quimica">Química ou Coloração</option>
                <option value="estetica">Estética ou Sobrancelha</option>
              </select>
            </div>
          </div>

          <div className="custom-service-actions">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setShowCustomForm(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary btn-sm">
              <HugeiconsIcon icon={Add01Icon} size={14} />
              <span>Salvar Serviço</span>
            </button>
          </div>
        </form>
      )}

      <div className="onboarding-actions">
        <button
          type="button"
          className="btn-secondary btn-lg"
          onClick={onBack}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          <span>Voltar</span>
        </button>
        <button
          type="button"
          className="btn-primary btn-lg"
          onClick={onNext}
          disabled={services.length === 0}
        >
          <span>Continuar para Equipe</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
        </button>
      </div>
    </div>
  );
};
