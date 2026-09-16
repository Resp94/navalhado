import React from 'react';
import { formatCurrency } from '../../../../lib/currency';

export interface FluxoCaixaValorPrevistoProps {
  forecast: number;
  overdue: number;
}

/**
 * Saída Prevista e Conta a Pagar Vencida de um agrupamento (spec 037,
 * ticket 07): cada valor sempre ao lado do rótulo textual "previsto" ou
 * "vencido" -- a distinção nunca depende só de cor, mesma exigência já
 * aplicada à entrada estimada (`FluxoCaixaValorEstimado`).
 */
export const FluxoCaixaValorPrevisto: React.FC<FluxoCaixaValorPrevistoProps> = ({ forecast, overdue }) => {
  if (forecast === 0 && overdue === 0) {
    return <span className="text-text-secondary">—</span>;
  }

  return (
    <span className="inline-flex flex-col gap-[0.2rem]">
      {forecast !== 0 && (
        <span className="inline-flex items-center gap-[0.35rem]">
          {formatCurrency(forecast)}
          <span className="inline-flex items-center px-[0.4rem] py-[0.1rem] rounded-full text-[0.65rem] font-bold uppercase tracking-[0.03em] bg-warning-bg text-warning">
            previsto
          </span>
        </span>
      )}
      {overdue !== 0 && (
        <span className="inline-flex items-center gap-[0.35rem]">
          {formatCurrency(overdue)}
          <span className="inline-flex items-center px-[0.4rem] py-[0.1rem] ml-[0.35rem] rounded-full text-[0.65rem] font-bold uppercase tracking-[0.03em] bg-[#c0392b]/[0.12] text-[#c0392b]">
            vencido
          </span>
        </span>
      )}
    </span>
  );
};
