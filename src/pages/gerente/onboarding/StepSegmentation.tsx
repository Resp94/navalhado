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
    <div data-testid="step-segmentation">
      <div>
        <span className="inline-block text-xs font-bold uppercase tracking-[0.5px] text-brand-primary bg-brand-lightest py-1 px-2.5 rounded-sm mb-2">Etapa 2 de 4 • Preço e Canal</span>
        <h2 className="text-[1.45rem] font-bold text-text-primary m-0 mb-2 leading-[1.3]">Qual é o valor médio do seu corte?</h2>
        <p className="text-[0.92rem] text-text-secondary m-0 mb-7 leading-[1.5]">
          Usamos este valor como base para sugerir os preços da barba e dos combos no próximo passo.
        </p>
      </div>

      {/* Card do Plano Ativo */}
      <div className="bg-[linear-gradient(135deg,#FFF9F5_0%,#FFF2E8_100%)] border-[1.5px] border-brand-soft rounded-lg py-5 px-6 relative">
        <div className="absolute -top-2.5 right-[18px] bg-brand-primary text-white text-[0.72rem] font-bold uppercase py-[0.2rem] px-2.5 rounded-full">Seu Plano Ativo</div>
        <div>
          <div>
            <h3 className="text-xl font-bold text-text-primary m-0 mb-1">Plano {planName || 'Bronze'}</h3>
            <p className="text-[0.85rem] text-text-secondary m-0">
              Organização completa da agenda, clientes e equipe da sua barbearia.
            </p>
          </div>
          <div>
            <span className="inline-block mt-3 bg-white border border-border py-[0.4rem] px-[0.85rem] rounded-md text-[0.82rem] text-text-primary">
              Limite de até <strong>{maxProfessionals > 100 ? 'Ilimitados' : maxProfessionals} profissionais</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-[1.15rem] mt-6">
        {/* Preço do Corte Tradicional */}
        <div className="flex flex-col gap-[0.4rem] w-full">
          <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="base-price-input">
            Preço do Corte Tradicional <span className="text-brand-primary">*</span>
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 font-bold text-brand-primary text-[1.1rem]">R$</span>
            <input
              id="base-price-input"
              type="text"
              inputMode="numeric"
              className="w-full h-12 pl-11 pr-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[1.15rem] font-bold font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
              placeholder="0,00"
              value={formattedDisplayPrice}
              onChange={handlePriceChange}
              autoFocus
            />
          </div>
          <span className="text-[0.78rem] text-text-secondary leading-[1.4] mt-[0.2rem]">
            Você poderá alterar o valor de qualquer serviço sempre que quiser.
          </span>
        </div>

        {/* Canal de Origem */}
        <div className="flex flex-col gap-[0.4rem] w-full">
          <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="channel-select">
            Como você conheceu o Navalhado? <span className="text-brand-primary">*</span>
          </label>
          <select
            id="channel-select"
            className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
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
          <span className="text-[0.78rem] text-text-secondary leading-[1.4] mt-[0.2rem]">
            Queremos entender como você chegou até nós para continuar melhorando o sistema.
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-border max-[680px]:flex-col-reverse max-[680px]:gap-3 max-[680px]:[&>button]:w-full">
        <button
          type="button"
          className="bg-white text-text-primary border-[1.5px] border-border font-semibold font-[inherit] rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-2 enabled:hover:bg-[#FDF9F6] enabled:hover:border-[#D3C4B8] h-12 px-[1.65rem] text-[0.98rem]"
          onClick={onBack}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          <span>Voltar ao Endereço</span>
        </button>
        <button
          type="button"
          className="bg-brand-primary text-white border-none font-bold font-[inherit] rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-2 enabled:hover:bg-brand-hover enabled:hover:-translate-y-px enabled:hover:shadow-[0_3px_8px_rgba(217,108,0,0.25)] disabled:opacity-50 disabled:cursor-not-allowed h-12 px-[1.65rem] text-[0.98rem]"
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
