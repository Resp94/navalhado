import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  ArrowRight01Icon, 
  ArrowLeft01Icon 
} from '@hugeicons/core-free-icons';
import type { OnboardingSegmentation } from './types';

interface StepSegmentationProps {
  data: OnboardingSegmentation;
  planName: string;
  maxProfessionals: number;
  onChange: (data: Partial<OnboardingSegmentation>) => void;
  onNext: () => void;
  onBack: () => void;
}

const ACQUISITION_CHANNELS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'indicacao', label: 'Indicação de outro barbeiro ou amigo' },
  { value: 'google', label: 'Pesquisa no Google' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'eventos', label: 'Evento ou workshop presencial' },
  { value: 'outro', label: 'Outro canal' },
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

  const formattedDisplayPrice = data.baseCutPrice > 0
    ? data.baseCutPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

  const isValid = data.baseCutPrice > 0 && data.acquisitionChannel.trim().length > 0;

  return (
    <div className="onboarding-step" data-testid="step-segmentation">
      <div className="onboarding-step-header">
        <span className="step-pill">Etapa 2 de 4 • Preço e Canal</span>
        <h2>Qual é o valor médio do seu corte?</h2>
        <p className="onboarding-step-subtitle">
          Usamos este valor como base para sugerir os preços da barba e dos combos no próximo passo.
        </p>
      </div>

      {/* Card do Plano Ativo */}
      <div className="plan-summary-card">
        <div className="plan-summary-card__badge">Seu Plano Ativo</div>
        <div className="plan-summary-card__header">
          <div>
            <h3 className="plan-summary-card__title">Plano {planName || 'Bronze'}</h3>
            <p className="plan-summary-card__desc">
              Organização completa da agenda, clientes e equipe da sua barbearia.
            </p>
          </div>
          <div className="plan-summary-card__quota">
            <span className="quota-tag">
              Limite de até <strong>{maxProfessionals > 100 ? 'Ilimitados' : maxProfessionals} profissionais</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="onboarding-form-grid" style={{ marginTop: '1.5rem' }}>
        {/* Preço do Corte Tradicional */}
        <div className="form-group form-group--full">
          <label className="form-label" htmlFor="base-price-input">
            Preço do Corte Tradicional <span className="text-required">*</span>
          </label>
          <div className="currency-input-wrapper">
            <span className="currency-prefix">R$</span>
            <input
              id="base-price-input"
              type="text"
              inputMode="numeric"
              className="form-input currency-input"
              placeholder="0,00"
              value={formattedDisplayPrice}
              onChange={handlePriceChange}
              autoFocus
            />
          </div>
          <span className="form-hint">
            Você poderá alterar o valor de qualquer serviço sempre que quiser.
          </span>
        </div>

        {/* Canal de Origem */}
        <div className="form-group form-group--full">
          <label className="form-label" htmlFor="channel-select">
            Como você conheceu o Navalhado? <span className="text-required">*</span>
          </label>
          <select
            id="channel-select"
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
          <span className="form-hint">
            Queremos entender como você chegou até nós para continuar melhorando o sistema.
          </span>
        </div>
      </div>

      <div className="onboarding-actions">
        <button
          type="button"
          className="btn-secondary btn-lg"
          onClick={onBack}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          <span>Voltar ao Endereço</span>
        </button>
        <button
          type="button"
          className="btn-primary btn-lg"
          onClick={onNext}
          disabled={!isValid}
        >
          <span>Continuar para Serviços</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
        </button>
      </div>
    </div>
  );
};
