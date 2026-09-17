import React, { useState, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  ArrowRight01Icon 
} from '@hugeicons/core-free-icons';
import type { OnboardingLocation } from './types';
import { fetchAddressByCep, formatCep, cleanCepDigits } from '../../../lib/cep';

interface StepLocationProps {
  data: OnboardingLocation;
  onChange: (data: Partial<OnboardingLocation>) => void;
  onNext: () => void;
}

export const StepLocation: React.FC<StepLocationProps> = ({
  data,
  onChange,
  onNext,
}) => {
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const lastSearchedCepRef = useRef<string>('');

  const performLookup = async (cepValue: string) => {
    const cleanCep = cleanCepDigits(cepValue);
    if (cleanCep.length === 8) {
      if (lastSearchedCepRef.current === cleanCep && data.street) {
        return;
      }
      lastSearchedCepRef.current = cleanCep;
      setLoadingCep(true);
      setCepError(null);
      try {
        const address = await fetchAddressByCep(cleanCep);
        if (address) {
          onChange({
            street: address.street,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
          });
          if (!address.street) {
            setCepError('Cidade localizada. Por favor, preencha a rua e o bairro manualmente.');
          }
        } else {
          setCepError('CEP não encontrado. Digite o endereço manualmente abaixo.');
        }
      } catch {
        setCepError('Não foi possível buscar o CEP agora. Preencha os campos abaixo.');
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    onChange({ cep: formatted });
    setCepError(null);

    const cleanCep = cleanCepDigits(formatted);
    if (cleanCep.length === 8) {
      performLookup(cleanCep);
    }
  };

  const handleCepBlur = () => {
    const cleanCep = cleanCepDigits(data.cep);
    if (cleanCep.length === 8) {
      performLookup(cleanCep);
    }
  };

  const handleCepKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cleanCep = cleanCepDigits(data.cep);
      if (cleanCep.length === 8) {
        performLookup(cleanCep);
      }
    }
  };

  const isValid =
    cleanCepDigits(data.cep).length === 8 &&
    data.street.trim().length > 0 &&
    data.number.trim().length > 0 &&
    data.neighborhood.trim().length > 0 &&
    data.city.trim().length > 0 &&
    data.state.trim().length > 0;

  return (
    <div data-testid="step-location">
      <div>
        <span className="inline-block text-xs font-bold uppercase tracking-[0.5px] text-brand-primary bg-brand-lightest py-1 px-2.5 rounded-sm mb-2">Etapa 1 de 4 • Endereço</span>
        <h2 className="text-[1.45rem] font-bold text-text-primary m-0 mb-2 leading-[1.3]">Onde fica a sua barbearia?</h2>
        <p className="text-[0.92rem] text-text-secondary m-0 mb-7 leading-[1.5]">
          Informe o endereço para ativar a rota no mapa e facilitar o agendamento dos seus clientes.
        </p>
      </div>

      <div className="flex flex-wrap gap-[1.15rem]">
        <div className="flex flex-col gap-[0.4rem] w-[calc(50%-0.6rem)] max-[680px]:w-full">
          <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="country-fixed">País de Atuação</label>
          <div className="flex items-center gap-[0.6rem] h-11 px-[0.9rem] bg-[#FDF9F6] border-[1.5px] border-border rounded-md text-[0.92rem] font-medium" id="country-fixed">
            <span>BR</span>
            <span>Brasil</span>
            <span className="ml-auto text-[0.72rem] bg-[#EAE0D8] text-text-secondary py-[0.15rem] px-[0.45rem] rounded-sm">Nacional</span>
          </div>
        </div>

        <div className="flex flex-col gap-[0.4rem] w-[calc(50%-0.6rem)] max-[680px]:w-full">
          <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="cep-input">
            CEP <span className="text-brand-primary">*</span>
          </label>
          <div className="relative">
            <input
              id="cep-input"
              type="text"
              className={`w-full h-11 px-[0.9rem] bg-white rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)] ${cepError ? 'border-[1.5px] border-error' : 'border-[1.5px] border-border'}`}
              placeholder="00000-000"
              value={data.cep}
              onChange={handleCepChange}
              onBlur={handleCepBlur}
              onKeyDown={handleCepKeyDown}
              maxLength={9}
              autoFocus
            />
            {loadingCep && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base" title="Buscando CEP nos Correios...">...</span>}
          </div>
          {cepError ? (
            <span className="text-[0.78rem] text-error mt-[0.2rem]">{cepError}</span>
          ) : (
            <span className="text-[0.78rem] text-text-secondary leading-[1.4] mt-[0.2rem]">Digite o CEP para preencher rua, bairro e cidade automaticamente.</span>
          )}
        </div>

        <div className="flex flex-col gap-[0.4rem] w-[calc(75%-0.6rem)] max-[680px]:w-full">
          <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="street-input">
            Rua ou Avenida <span className="text-brand-primary">*</span>
          </label>
          <input
            id="street-input"
            type="text"
            className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
            placeholder="Ex: Av. Paulista, Rua das Flores"
            value={data.street}
            onChange={(e) => onChange({ street: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-[0.4rem] w-[calc(25%-0.6rem)] max-[680px]:w-full">
          <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="number-input">
            Número <span className="text-brand-primary">*</span>
          </label>
          <input
            id="number-input"
            type="text"
            className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
            placeholder="Ex: 1000 ou S/N"
            value={data.number}
            onChange={(e) => onChange({ number: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-[0.4rem] w-[calc(50%-0.6rem)] max-[680px]:w-full">
          <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="complement-input">
            Complemento <span className="font-normal text-text-secondary text-[0.78rem]">(opcional)</span>
          </label>
          <input
            id="complement-input"
            type="text"
            className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
            placeholder="Ex: Sala 2, Sobreloja, Galeria A"
            value={data.complement || ''}
            onChange={(e) => onChange({ complement: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-[0.4rem] w-[calc(50%-0.6rem)] max-[680px]:w-full">
          <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="neighborhood-input">
            Bairro <span className="text-brand-primary">*</span>
          </label>
          <input
            id="neighborhood-input"
            type="text"
            className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
            placeholder="Ex: Centro, Bela Vista"
            value={data.neighborhood}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-[0.4rem] w-[calc(75%-0.6rem)] max-[680px]:w-full">
          <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="city-input">
            Cidade <span className="text-brand-primary">*</span>
          </label>
          <input
            id="city-input"
            type="text"
            className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
            placeholder="Ex: São Paulo"
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-[0.4rem] w-[calc(25%-0.6rem)] max-[680px]:w-full">
          <label className="text-[0.85rem] font-semibold text-text-primary" htmlFor="state-input">
            Estado (UF) <span className="text-brand-primary">*</span>
          </label>
          <input
            id="state-input"
            type="text"
            className="w-full h-11 px-[0.9rem] bg-white border-[1.5px] border-border rounded-md text-text-primary text-[0.92rem] font-[inherit] box-border transition-all duration-200 ease-in focus:outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)]"
            placeholder="SP"
            value={data.state}
            onChange={(e) => onChange({ state: e.target.value.toUpperCase().slice(0, 2) })}
            maxLength={2}
          />
        </div>
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-border max-[680px]:flex-col-reverse max-[680px]:gap-3 max-[680px]:[&>button]:w-full">
        <div className="text-[0.78rem] text-text-secondary">
          <span>* Preenchimento necessário para localizar seu salão</span>
        </div>
        <button
          type="button"
          className="bg-brand-primary text-white border-none font-bold font-[inherit] rounded-md cursor-pointer transition-all duration-200 ease-in inline-flex items-center justify-center gap-2 enabled:hover:bg-brand-hover enabled:hover:-translate-y-px enabled:hover:shadow-[0_3px_8px_rgba(217,108,0,0.25)] disabled:opacity-50 disabled:cursor-not-allowed h-12 px-[1.65rem] text-[0.98rem]"
          onClick={onNext}
          disabled={!isValid || loadingCep}
        >
          <span>Continuar para o Preço Base</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
        </button>
      </div>
    </div>
  );
};
