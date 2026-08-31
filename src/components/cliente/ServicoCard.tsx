import React from 'react';
import type { ServicoCanal } from '../../modules/canal-cliente/types';

export interface ServicoCardProps {
  service: ServicoCanal;
  onSelect: (service: ServicoCanal) => void;
  isSelected?: boolean;
}

export const ServicoCard: React.FC<ServicoCardProps> = ({
  service,
  onSelect,
  isSelected = false,
}) => {
  const formattedPrice = Number(service.price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <div
      onClick={() => onSelect(service)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(service);
        }
      }}
      className={`servico-card ${isSelected ? 'servico-card--selected' : ''}`}
    >
      <div className="servico-card__header">
        <h3 className="servico-card__title">
          {service.name}
        </h3>
        <span className="servico-card__price">
          {formattedPrice}
        </span>
      </div>

      <div className="servico-card__meta">
        <span className="servico-card__duration">
          {service.duration_minutes} min
        </span>
        {service.category && (
          <>
            <span style={{ fontSize: '0.625rem', color: '#70625B', opacity: 0.5 }}>•</span>
            <span className="servico-card__category">
              {service.category}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
