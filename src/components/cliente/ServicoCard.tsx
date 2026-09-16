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
      className={`w-full py-[0.875rem] px-[1.125rem] rounded-2xl bg-white border cursor-pointer text-left select-none transition-all duration-200 box-border shadow-[0_1px_3px_rgba(45,35,30,0.04)] hover:border-[rgba(217,108,0,0.6)] ${
        isSelected
          ? 'bg-brand-lightest border-brand-primary shadow-[0_1px_4px_rgba(217,108,0,0.18)]'
          : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-text-primary m-0 tracking-[-0.01em] leading-[1.3]">
          {service.name}
        </h3>
        <span className="text-sm font-extrabold text-brand-primary shrink-0">
          {formattedPrice}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs font-semibold text-text-secondary">
          {service.duration_minutes} min
        </span>
        {service.category && (
          <>
            <span className="text-[0.625rem] text-text-secondary opacity-50">•</span>
            <span className="text-xs text-text-secondary">
              {service.category}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
