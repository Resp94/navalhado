import React from 'react';
import { formatCurrency } from '../../../../lib/currency';

export interface FluxoCaixaValorEstimadoProps {
  /**
   * `null` significa "vazio" (histórico insuficiente), nunca "zerado". A
   * distinção visual usa um rótulo textual e uma variante explícita de
   * exibição, nunca só cor (spec 037, ticket 03).
   */
  value: number | null;
}

/**
 * Valor estimado da aba Fluxo de Caixa Projetado (spec 037, ticket 03):
 * usado no cartão de resumo e na coluna da tabela, sempre com o rótulo
 * "estimado" ao lado do valor -- nunca um número solto que possa ser
 * confundido com realizado.
 */
export const FluxoCaixaValorEstimado: React.FC<FluxoCaixaValorEstimadoProps> = ({ value }) => {
  if (value === null) {
    return <span className="text-xs italic text-text-secondary">histórico insuficiente</span>;
  }

  return (
    <span className="inline-flex items-center gap-[0.35rem]">
      {formatCurrency(value)}
      <span className="inline-flex items-center px-[0.4rem] py-[0.1rem] rounded-full text-[0.65rem] font-bold uppercase tracking-[0.03em] bg-info/[0.12] text-info">
        estimado
      </span>
    </span>
  );
};
