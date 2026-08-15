import React, { useState } from 'react';
import type { LocationData } from './types';

interface StepLocationProps {
  data: LocationData;
  onChange: (updated: Partial<LocationData>) => void;
  onNext: () => void;
}

export const StepLocation: React.FC<StepLocationProps> = ({ data, onChange, onNext }) => {
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    if (numbers.length > 5) {
      return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
    }
    return numbers;
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatCep(rawValue);
    onChange({ cep: formatted });
    setCepError(null);

    const cleanCep = formatted.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        setLoadingCep(true);
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const cepData = await response.json();

        if (cepData.erro) {
          setCepError('CEP não encontrado. Por favor, preencha o endereço manualmente.');
          return;
        }

        onChange({
          street: cepData.logradouro || '',
          neighborhood: cepData.bairro || '',
          city: cepData.localidade || '',
          state: cepData.uf || '',
        });

        // Geocodificação silenciosa via Nominatim OpenStreetMap
        try {
          const query = encodeURIComponent(`${cepData.logradouro}, ${cepData.localidade}, ${cepData.uf}, Brasil`);
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
            headers: { 'Accept-Language': 'pt-BR' }
          });
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            onChange({
              latitude: parseFloat(geoData[0].lat),
              longitude: parseFloat(geoData[0].lon)
            });
          }
        } catch {
          // Geocodificação opcional
        }
      } catch {
        setCepError('Erro ao consultar CEP. Preencha manualmente.');
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const isValid = 
    data.cep.replace(/\D/g, '').length === 8 &&
    data.street.trim().length > 0 &&
    data.number.trim().length > 0 &&
    data.neighborhood.trim().length > 0 &&
    data.city.trim().length > 0 &&
    data.state.trim().length > 0;

  return (
    <div className="onboarding-step" data-testid="step-location">
      <div className="onboarding-step-header">
        <h2>Onde fica a sua barbearia?</h2>
        <p className="onboarding-step-subtitle">
          Informe o endereço para exibirmos a localização precisa no mapa e no aplicativo dos clientes.
        </p>
      </div>

      <div className="onboarding-form-grid">
        {/* País Fixo Brasil */}
        <div className="form-group">
          <label className="form-label">País</label>
          <div className="input-country-fixed">
            <span className="country-flag">🇧🇷</span>
            <span className="country-name">Brasil</span>
          </div>
        </div>

        {/* CEP */}
        <div className="form-group">
          <label className="form-label" htmlFor="cep-input">
            CEP <span className="required-star">*</span>
          </label>
          <div className="input-with-spinner">
            <input
              id="cep-input"
              type="text"
              className="form-input"
              placeholder="00000-000"
              value={data.cep}
              onChange={handleCepChange}
              maxLength={9}
            />
            {loadingCep && <span className="spinner-inline" title="Buscando CEP...">⌛</span>}
          </div>
          {cepError && <p className="form-error-msg">{cepError}</p>}
        </div>

        {/* Logradouro / Rua */}
        <div className="form-group span-2">
          <label className="form-label" htmlFor="street-input">
            Endereço / Rua <span className="required-star">*</span>
          </label>
          <input
            id="street-input"
            type="text"
            className="form-input"
            placeholder="Ex: Av. Paulista"
            value={data.street}
            onChange={(e) => onChange({ street: e.target.value })}
          />
        </div>

        {/* Número */}
        <div className="form-group">
          <label className="form-label" htmlFor="number-input">
            Número <span className="required-star">*</span>
          </label>
          <input
            id="number-input"
            type="text"
            className="form-input"
            placeholder="Ex: 154"
            value={data.number}
            onChange={(e) => onChange({ number: e.target.value })}
          />
        </div>

        {/* Complemento */}
        <div className="form-group">
          <label className="form-label" htmlFor="complement-input">
            Complemento <span className="optional-tag">(opcional)</span>
          </label>
          <input
            id="complement-input"
            type="text"
            className="form-input"
            placeholder="Ex: Sala 2, Sobreloja"
            value={data.complement || ''}
            onChange={(e) => onChange({ complement: e.target.value })}
          />
        </div>

        {/* Bairro */}
        <div className="form-group">
          <label className="form-label" htmlFor="neighborhood-input">
            Bairro <span className="required-star">*</span>
          </label>
          <input
            id="neighborhood-input"
            type="text"
            className="form-input"
            placeholder="Ex: Bela Vista"
            value={data.neighborhood}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
          />
        </div>

        {/* Cidade */}
        <div className="form-group">
          <label className="form-label" htmlFor="city-input">
            Cidade <span className="required-star">*</span>
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

        {/* Estado / UF */}
        <div className="form-group">
          <label className="form-label" htmlFor="state-input">
            Estado (UF) <span className="required-star">*</span>
          </label>
          <input
            id="state-input"
            type="text"
            className="form-input"
            placeholder="Ex: SP"
            value={data.state}
            onChange={(e) => onChange({ state: e.target.value.toUpperCase().slice(0, 2) })}
            maxLength={2}
          />
        </div>
      </div>

      <div className="onboarding-actions">
        <div />
        <button
          type="button"
          className="btn-onboarding-primary"
          onClick={onNext}
          disabled={!isValid || loadingCep}
        >
          Continuar para Segmentação →
        </button>
      </div>
    </div>
  );
};
