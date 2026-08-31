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
      className={`w-full p-1 rounded-2xl transition-all duration-200 cursor-pointer text-left select-none ${
        isSelected
          ? 'bg-[#D96C00]/10 border border-[#D96C00]'
          : 'bg-[#D96C00]/[0.03] border border-[#EADED6] hover:border-[#D96C00]/50'
      }`}
    >
      <div
        className={`w-full py-3.5 px-4 rounded-xl border transition-all duration-200 flex flex-col justify-center ${
          isSelected
            ? 'bg-[#FFF1E6] border-[#D96C00]'
            : 'bg-white border-[#EADED6]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-[#2D231E] m-0 tracking-tight leading-snug">
            {service.name}
          </h3>
          <span className="text-sm font-extrabold text-[#D96C00] shrink-0">
            {formattedPrice}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-semibold text-[#70625B]">
            {service.duration_minutes} min
          </span>
          {service.category && (
            <>
              <span className="text-[10px] text-[#70625B]/50">•</span>
              <span className="text-xs text-[#70625B]">
                {service.category}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
