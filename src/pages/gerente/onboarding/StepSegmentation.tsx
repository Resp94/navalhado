import React from 'react';
import type { SegmentationData } from './types';

interface StepSegmentationProps {
  data: SegmentationData;
  planName: string;
  maxProfessionals: number;
  onChange: (updated: Partial<SegmentationData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const ACQUISITION_CHANNELS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'google', label: 'Google / Busca na Web' },
  { value: 'indicacao', label: 'Indicação de Amigo ou Barbeiro' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'eventos', label: 'Feiras ou Eventos de Barbearia' },
  { value: 'outros', label: 'Outro Canal' },
];

export const StepSegmentation: React.FC<StepSegmentationProps> = ({
  data,
  planName,
  maxProfessionals,
  onChange,
  onNext,
  onBack,
}) => {
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    const numericValue = rawDigits ? parseInt(rawDigits, 10) / 100 : 0;
    onChange({ baseCutPrice: numericValue });
  };

  const isValid = data.baseCutPrice > 0 && data.acquisitionChannel.trim().length > 0;

  return (
    <div className="onboarding-step" data-testid="step-segmentation">
      <div className="onboarding-step-header">
        <h2>Perfil Comercial e Referência de Preço</h2>
        <p className="onboarding-step-subtitle">
          Calibre a precificação da barbearia para relatórios e sugestões inteligentes de serviços.
        </p>
      </div>

      {/* Card do Plano Ativo */}
      <div className="plan-summary-card">
        <div className="plan-summary-badge">Plano Ativo</div>
        <div className="plan-summary-info">
          <h3>Plano {planName || 'Bronze'}</h3>
          <p>
            Capacidade contratada para até <strong>{maxProfessionals || 3} profissionais simultâneos</strong> na agenda.
          </p>
        </div>
      </div>

      <div className="onboarding-form-grid">
        {/* Preço Base do Corte */}
        <div className="form-group span-2">
          <label className="form-label" htmlFor="cut-price-input">
            Qual é o preço médio do corte tradicional na sua barbearia? <span className="required-star">*</span>
          </label>
          <div className="input-currency-wrapper">
            <span className="currency-symbol">R$</span>
            <input
              id="cut-price-input"
              type="text"
              className="form-input currency-input"
              placeholder="0,00"
              value={data.baseCutPrice > 0 ? data.baseCutPrice.toFixed(2).replace('.', ',') : ''}
              onChange={handlePriceChange}
            />
          </div>
          <span className="form-help-text">
            Este valor será utilizado como sugestão padrão no próximo passo para cadastrar seu primeiro serviço.
          </span>
        </div>

        {/* Canal de Aquisição */}
        <div className="form-group span-2">
          <label className="form-label" htmlFor="acquisition-channel-select">
            Como você conheceu o Navalhado? <span className="required-star">*</span>
          </label>
          <select
            id="acquisition-channel-select"
            className="form-select"
            value={data.acquisitionChannel}
            onChange={(e) => onChange({ acquisitionChannel: e.target.value })}
          >
            <option value="">Selecione uma opção...</option>
            {ACQUISITION_CHANNELS.map((ch) => (
              <option key={ch.value} value={ch.value}>
                {ch.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="onboarding-actions">
        <button type="button" className="btn-onboarding-secondary" onClick={onBack}>
          ← Voltar para Localização
        </button>
        <button
          type="button"
          className="btn-onboarding-primary"
          onClick={onNext}
          disabled={!isValid}
        >
          Continuar para Serviços →
        </button>
      </div>
    </div>
  );
};
