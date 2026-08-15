import React, { useState } from 'react';
import type { ServiceItem } from './types';

interface StepServicesProps {
  services: ServiceItem[];
  baseCutPrice: number;
  onAddService: (service: Omit<ServiceItem, 'id'>) => void;
  onRemoveService: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const TEMPLATE_SERVICES = [
  { name: 'Corte Tradicional', priceRatio: 1.0, durationMinutes: 30, category: 'cabelo' },
  { name: 'Barba', priceRatio: 0.75, durationMinutes: 30, category: 'barba' },
  { name: 'Corte + Barba', priceRatio: 1.6, durationMinutes: 45, category: 'combo' },
  { name: 'Pezinho / Acabamento', priceRatio: 0.4, durationMinutes: 15, category: 'cabelo' },
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
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddTemplate = (tpl: typeof TEMPLATE_SERVICES[0]) => {
    const calculatedPrice = baseCutPrice > 0 
      ? Math.round(baseCutPrice * tpl.priceRatio) 
      : 35;

    // Se já tiver serviço com mesmo nome, avisa
    if (services.some(s => s.name.toLowerCase() === tpl.name.toLowerCase())) {
      setFormError(`O serviço "${tpl.name}" já foi adicionado.`);
      return;
    }

    setFormError(null);
    onAddService({
      name: tpl.name,
      price: calculatedPrice,
      durationMinutes: tpl.durationMinutes,
      category: tpl.category,
    });
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setFormError('Informe o nome do serviço.');
      return;
    }

    const priceNum = parseFloat(customPrice.replace(',', '.'));
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Informe um valor válido em reais.');
      return;
    }

    if (services.some(s => s.name.toLowerCase() === customName.trim().toLowerCase())) {
      setFormError(`O serviço "${customName.trim()}" já está na lista.`);
      return;
    }

    setFormError(null);
    onAddService({
      name: customName.trim(),
      price: priceNum,
      durationMinutes: parseInt(customDuration, 10) || 30,
      category: customCategory,
    });

    setCustomName('');
    setCustomPrice('');
    setCustomDuration('30');
  };

  return (
    <div className="onboarding-step" data-testid="step-services">
      <div className="onboarding-step-header">
        <h2>Monte seu Cardápio Inicial de Serviços</h2>
        <p className="onboarding-step-subtitle">
          Adicione os serviços mais procurados com 1 clique ou cadastre seus próprios serviços personalizados.
        </p>
      </div>

      {/* Sugestões em 1 clique */}
      <div className="services-templates-section">
        <label className="section-small-title">Sugestões Rápidas (1 clique para adicionar):</label>
        <div className="template-chips-grid">
          {TEMPLATE_SERVICES.map((tpl) => {
            const isAdded = services.some(s => s.name.toLowerCase() === tpl.name.toLowerCase());
            const price = baseCutPrice > 0 ? Math.round(baseCutPrice * tpl.priceRatio) : 35;
            return (
              <button
                key={tpl.name}
                type="button"
                className={`template-chip ${isAdded ? 'template-chip--added' : ''}`}
                onClick={() => !isAdded && handleAddTemplate(tpl)}
                disabled={isAdded}
              >
                <span className="template-chip__title">{tpl.name}</span>
                <span className="template-chip__meta">
                  R$ {price.toFixed(2).replace('.', ',')} • {tpl.durationMinutes} min
                </span>
                {isAdded && <span className="template-chip__badge">✓ Adicionado</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulário de Serviço Customizado */}
      <div className="custom-service-box">
        <label className="section-small-title">Adicionar Serviço Personalizado:</label>
        <form className="custom-service-form" onSubmit={handleAddCustom}>
          <div className="form-group flex-2">
            <input
              type="text"
              className="form-input"
              placeholder="Nome do serviço (ex: Platinado)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>

          <div className="form-group flex-1">
            <input
              type="text"
              className="form-input"
              placeholder="Valor R$ (ex: 50,00)"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
            />
          </div>

          <div className="form-group flex-1">
            <select
              className="form-select"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
            >
              {DURATION_OPTIONS.map((min) => (
                <option key={min} value={min}>
                  {min} min
                </option>
              ))}
            </select>
          </div>

          <div className="form-group flex-1">
            <select
              className="form-select"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
            >
              <option value="cabelo">Cabelo</option>
              <option value="barba">Barba</option>
              <option value="combo">Combo</option>
              <option value="estetica">Estética / Outros</option>
            </select>
          </div>

          <button type="submit" className="btn-add-service">
            + Adicionar
          </button>
        </form>
        {formError && <p className="form-error-msg">{formError}</p>}
      </div>

      {/* Lista de Serviços Cadastrados */}
      <div className="added-services-list">
        <label className="section-small-title">
          Serviços Cadastrados ({services.length}):
        </label>

        {services.length === 0 ? (
          <div className="services-empty-state">
            <p>Nenhum serviço adicionado ainda. Escolha uma sugestão acima ou adicione manualmente.</p>
          </div>
        ) : (
          <table className="onboarding-table">
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Categoria</th>
                <th>Duração</th>
                <th>Valor</th>
                <th style={{ width: '80px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {services.map((srv) => (
                <tr key={srv.id}>
                  <td><strong>{srv.name}</strong></td>
                  <td><span className="badge-category">{srv.category}</span></td>
                  <td>{srv.durationMinutes} min</td>
                  <td>R$ {srv.price.toFixed(2).replace('.', ',')}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-remove-row"
                      onClick={() => onRemoveService(srv.id)}
                      title="Remover serviço"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="onboarding-actions">
        <button type="button" className="btn-onboarding-secondary" onClick={onBack}>
          ← Voltar para Segmentação
        </button>
        <button
          type="button"
          className="btn-onboarding-primary"
          onClick={onNext}
          disabled={services.length === 0}
        >
          Continuar para Equipe ({services.length} {services.length === 1 ? 'serviço' : 'serviços'}) →
        </button>
      </div>
    </div>
  );
};
