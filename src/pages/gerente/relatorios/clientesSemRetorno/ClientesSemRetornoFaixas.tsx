import React from 'react';
import { SegmentedControl } from '../../../../components/ui/navigation/SegmentedControl';
import type { RelatorioClientesSemRetornoBand, RelatorioClientesSemRetornoFaixas } from '../../../../modules/relatorios/types';

/** Valor de "nenhuma faixa selecionada" -- lista sem filtro de `p_overdue_band`. */
export const TODAS_AS_FAIXAS = '';

export type FiltroFaixa = RelatorioClientesSemRetornoBand | typeof TODAS_AS_FAIXAS;

export interface ClientesSemRetornoFaixasProps {
  bands: RelatorioClientesSemRetornoFaixas | null;
  value: FiltroFaixa;
  onChange: (value: FiltroFaixa) => void;
}

/**
 * Filtro de faixa de atraso da página Clientes sem Retorno (spec 038,
 * ticket 09): até 15, 16 a 30, 31 a 60 e mais de 60 dias, cada opção já
 * mostrando quantos clientes estão nela -- as contagens ignoram paginação
 * e o próprio filtro de faixa (mas respeitam o filtro de profissional),
 * então elas não mudam quando o gestor troca de faixa, só quando troca de
 * profissional. Escolher uma faixa refaz a busca da lista no servidor
 * (`p_overdue_band`); os totais e as próprias contagens das faixas nunca
 * são afetados por essa escolha.
 */
export const ClientesSemRetornoFaixas: React.FC<ClientesSemRetornoFaixasProps> = ({ bands, value, onChange }) => {
  return (
    <SegmentedControl<FiltroFaixa>
      aria-label="Filtrar por faixa de atraso"
      value={value}
      onChange={onChange}
      size="sm"
      fullWidth={false}
      options={[
        { id: TODAS_AS_FAIXAS, label: 'Todas as faixas', count: undefined },
        { id: 'up_to_15', label: 'Até 15 dias', count: bands?.up_to_15 ?? 0 },
        { id: 'd16_30', label: '16 a 30 dias', count: bands?.d16_30 ?? 0 },
        { id: 'd31_60', label: '31 a 60 dias', count: bands?.d31_60 ?? 0 },
        { id: 'over_60', label: 'Mais de 60 dias', count: bands?.over_60 ?? 0 },
      ]}
    />
  );
};
