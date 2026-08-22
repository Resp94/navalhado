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
    <div className="onboarding-step" data-testid="step-location">
      <div className="onboarding-step-header">
        <span className="step-pill">Etapa 1 de 4 • Endereço</span>
        <h2>Onde fica a sua barbearia?</h2>
        <p className="onboarding-step-subtitle">
          Informe o endereço para ativar a rota no mapa e facilitar o agendamento dos seus clientes.
        </p>
      </div>

      <div className="onboarding-form-grid">
        <div className="form-group form-group--half">
          <label className="form-label" htmlFor="country-fixed">País de Atuação</label>
          <div className="input-country-fixed" id="country-fixed">
            <span className="country-flag-text">BR</span>
            <span className="country-name">Brasil</span>
            <span className="country-badge">Nacional</span>
          </div>
        </div>

        <div className="form-group form-group--half">
          <label className="form-label" htmlFor="cep-input">
            CEP <span className="text-required">*</span>
          </label>
          <div className="input-with-loading">
            <input
              id="cep-input"
              type="text"
              className={`form-input ${cepError ? 'form-input--error' : ''}`}
              placeholder="00000-000"
              value={data.cep}
              onChange={handleCepChange}
              onBlur={handleCepBlur}
              onKeyDown={handleCepKeyDown}
              maxLength={9}
              autoFocus
            />
            {loadingCep && <span className="spinner-sm" title="Buscando CEP nos Correios...">...</span>}
          </div>
          {cepError ? (
            <span className="form-error">{cepError}</span>
          ) : (
            <span className="form-hint">Digite o CEP para preencher rua, bairro e cidade automaticamente.</span>
          )}
        </div>

        <div className="form-group form-group--3-4">
          <label className="form-label" htmlFor="street-input">
            Rua ou Avenida <span className="text-required">*</span>
          </label>
          <input
            id="street-input"
            type="text"
            className="form-input"
            placeholder="Ex: Av. Paulista, Rua das Flores"
            value={data.street}
            onChange={(e) => onChange({ street: e.target.value })}
          />
        </div>

        <div className="form-group form-group--1-4">
          <label className="form-label" htmlFor="number-input">
            Número <span className="text-required">*</span>
          </label>
          <input
            id="number-input"
            type="text"
            className="form-input"
            placeholder="Ex: 1000 ou S/N"
            value={data.number}
            onChange={(e) => onChange({ number: e.target.value })}
          />
        </div>

        <div className="form-group form-group--half">
          <label className="form-label" htmlFor="complement-input">
            Complemento <span className="form-label-opt">(opcional)</span>
          </label>
          <input
            id="complement-input"
            type="text"
            className="form-input"
            placeholder="Ex: Sala 2, Sobreloja, Galeria A"
            value={data.complement || ''}
            onChange={(e) => onChange({ complement: e.target.value })}
          />
        </div>

        <div className="form-group form-group--half">
          <label className="form-label" htmlFor="neighborhood-input">
            Bairro <span className="text-required">*</span>
          </label>
          <input
            id="neighborhood-input"
            type="text"
            className="form-input"
            placeholder="Ex: Centro, Bela Vista"
            value={data.neighborhood}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
          />
        </div>

        <div className="form-group form-group--3-4">
          <label className="form-label" htmlFor="city-input">
            Cidade <span className="text-required">*</span>
          </label>
          <input
            id="city-input"
            type="text"
            className="form-input"
            placeholder="Ex: São Paulo"
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        </div>

        <div className="form-group form-group--1-4">
          <label className="form-label" htmlFor="state-input">
            Estado (UF) <span className="text-required">*</span>
          </label>
          <input
            id="state-input"
            type="text"
            className="form-input"
            placeholder="SP"
            value={data.state}
            onChange={(e) => onChange({ state: e.target.value.toUpperCase().slice(0, 2) })}
            maxLength={2}
          />
        </div>
      </div>

      <div className="onboarding-actions">
        <div className="onboarding-actions__info">
          <span>* Preenchimento necessário para localizar seu salão</span>
        </div>
        <button
          type="button"
          className="btn-primary btn-lg"
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
