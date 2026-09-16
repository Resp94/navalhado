import React, { useState } from 'react';
import { SegmentedControl } from '../../../../components/ui/navigation/SegmentedControl';
import { CustomDatePicker } from '../../../../components/CustomDatePicker';
import { formatCurrencyInput } from '../../../../lib/currency';
import type { FluxoCaixaGranularity } from '../../../../modules/fluxo-caixa/types';
import type { FluxoCaixaPeriodShortcutId } from '../../../../modules/fluxo-caixa/periodo';

type ShortcutOrCustom = FluxoCaixaPeriodShortcutId | 'custom';

const SHORTCUT_OPTIONS: { id: ShortcutOrCustom; label: string }[] = [
  { id: 'next_30_days', label: 'Próximos 30 dias' },
  { id: 'this_month', label: 'Este mês' },
  { id: 'next_3_months', label: 'Próximos 3 meses' },
  { id: 'next_12_months', label: 'Próximos 12 meses' },
  { id: 'custom', label: 'Personalizado' },
];

const GRANULARITY_OPTIONS: { value: FluxoCaixaGranularity; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

export interface FluxoCaixaFiltrosProps {
  shortcut: ShortcutOrCustom;
  onShortcutChange: (id: ShortcutOrCustom) => void;
  startDate: string;
  endDate: string;
  onCustomDateChange: (startDate: string, endDate: string) => void;
  granularity: FluxoCaixaGranularity;
  onGranularityChange: (granularity: FluxoCaixaGranularity) => void;
  timezone: string;
  isCustom: boolean;
  /**
   * Texto digitado do saldo (ticket 04), formatado como moeda. Estado só de
   * tela: nunca gravado, nunca enviado ao banco, nunca posto na URL nem em
   * armazenamento do navegador -- mora no componente pai e desaparece ao
   * recarregar a página.
   */
  saldoInformadoInput: string;
  onSaldoInformadoInputChange: (value: string) => void;
  /** Falso num período inteiramente passado: não há o que projetar. */
  mostrarCampoSaldo: boolean;
}

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '--/--/----';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Filtros da aba Fluxo de Caixa Projetado (spec 037, ticket 01):
 * atalho de período, datas e granularidade. Parte de responsabilidade
 * única -- não decide período nem "hoje", só exibe e repassa a escolha.
 */
export const FluxoCaixaFiltros: React.FC<FluxoCaixaFiltrosProps> = ({
  shortcut,
  onShortcutChange,
  startDate,
  endDate,
  onCustomDateChange,
  granularity,
  onGranularityChange,
  timezone,
  isCustom,
  saldoInformadoInput,
  onSaldoInformadoInputChange,
  mostrarCampoSaldo,
}) => {
  const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);

  return (
    <section className="fluxo-caixa-filtros" aria-label="Filtros do fluxo de caixa projetado">
      <SegmentedControl<ShortcutOrCustom>
        aria-label="Atalho de período"
        value={shortcut}
        onChange={onShortcutChange}
        options={SHORTCUT_OPTIONS}
        size="sm"
        fullWidth={false}
      />

      <div className="fluxo-caixa-datas">
        <div className="fluxo-caixa-data-campo">
          <span>De</span>
          <button
            type="button"
            className="fluxo-caixa-data-btn"
            aria-label="Data inicial do fluxo de caixa"
            onClick={() => setOpenPicker(openPicker === 'start' ? null : 'start')}
          >
            {formatDisplayDate(startDate)}
          </button>
          {openPicker === 'start' && (
            <CustomDatePicker
              selectedDate={startDate}
              timezone={timezone}
              onSelectDate={(newDate) => {
                setOpenPicker(null);
                onCustomDateChange(newDate, endDate < newDate ? newDate : endDate);
              }}
              onClose={() => setOpenPicker(null)}
            />
          )}
        </div>

        <div className="fluxo-caixa-data-campo">
          <span>Até</span>
          <button
            type="button"
            className="fluxo-caixa-data-btn"
            aria-label="Data final do fluxo de caixa"
            onClick={() => setOpenPicker(openPicker === 'end' ? null : 'end')}
          >
            {formatDisplayDate(endDate)}
          </button>
          {openPicker === 'end' && (
            <CustomDatePicker
              selectedDate={endDate}
              timezone={timezone}
              onSelectDate={(newDate) => {
                setOpenPicker(null);
                onCustomDateChange(startDate > newDate ? newDate : startDate, newDate);
              }}
              onClose={() => setOpenPicker(null)}
              position="left"
            />
          )}
        </div>
      </div>

      <label className="fluxo-caixa-granularidade">
        <span>Granularidade</span>
        <select
          aria-label="Granularidade do agrupamento"
          value={granularity}
          disabled={!isCustom}
          onChange={(event) => onGranularityChange(event.target.value as FluxoCaixaGranularity)}
        >
          {GRANULARITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {mostrarCampoSaldo && (
        <label className="fluxo-caixa-saldo-campo">
          <span>Saldo disponível hoje (opcional)</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Saldo disponível hoje, opcional"
            placeholder="R$ 0,00"
            value={saldoInformadoInput}
            onChange={(event) => onSaldoInformadoInputChange(formatCurrencyInput(event.target.value))}
          />
        </label>
      )}
    </section>
  );
};
