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
    return <span className="fluxo-caixa-previsto-vazio">—</span>;
  }

  return (
    <span className="fluxo-caixa-previsto-grupo">
      {forecast !== 0 && (
        <span className="fluxo-caixa-previsto">
          {formatCurrency(forecast)}
          <span className="fluxo-caixa-previsto-badge">previsto</span>
        </span>
      )}
      {overdue !== 0 && (
        <span className="fluxo-caixa-vencido">
          {formatCurrency(overdue)}
          <span className="fluxo-caixa-vencido-badge">vencido</span>
        </span>
      )}
    </span>
  );
};
