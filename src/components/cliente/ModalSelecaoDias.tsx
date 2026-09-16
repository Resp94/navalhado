import React, { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import type { ServicoCanal } from '../../modules/canal-cliente/types';
import { shiftCalendarDate } from '../../lib/timezone';

export interface ModalSelecaoDiasProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServicoCanal | null;
  baseDate: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export const ModalSelecaoDias: React.FC<ModalSelecaoDiasProps> = ({
  isOpen,
  onClose,
  service,
  baseDate,
  selectedDate,
  onSelectDate,
}) => {
  const [weekOffset, setWeekOffset] = useState(0);

  const displayDays = useMemo(() => {
    const days: { dateStr: string; dayNumber: string; weekdayName: string; isPast: boolean }[] = [];
    const weekdaysNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const startShift = weekOffset * 6;
    const todayStr = baseDate;

    for (let i = 0; i < 6; i++) {
      const currentDateStr = shiftCalendarDate(baseDate, startShift + i);
      const [y, m, d] = currentDateStr.split('-').map(Number);
      const dObj = new Date(y, m - 1, d);
      const dayNum = String(d).padStart(2, '0');
      const monthNum = String(m).padStart(2, '0');
      const weekdayName = weekdaysNames[dObj.getDay()];
      const isPast = currentDateStr < todayStr;

      days.push({
        dateStr: currentDateStr,
        dayNumber: `${dayNum}/${monthNum}`,
        weekdayName,
        isPast,
      });
    }

    return days;
  }, [baseDate, weekOffset]);

  if (!isOpen || !service) return null;

  const formattedPrice = Number(service.price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const diaBtnBase =
    'py-[0.625rem] px-2 rounded-xl text-center border bg-white text-text-primary cursor-pointer transition-all duration-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(20,17,15,0.6)] backdrop-blur-[4px] box-border">
      <div className="w-full max-w-[390px] max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-border p-6 shadow-[0_16px_48px_rgba(45,35,30,0.2)] relative box-border">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-brand-lightest border border-border text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-brand-soft hover:text-text-primary"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Resumo do Serviço */}
        <div className="text-center pt-1 pb-4">
          <h2 className="text-base font-extrabold text-text-primary m-0">
            {service.name}
          </h2>
          <div className="inline-flex items-center gap-1.5 mt-1.5 py-1 px-3 rounded-full bg-brand-lightest border border-[rgba(242,178,119,0.6)] text-xs font-bold text-brand-primary">
            <span>{formattedPrice}</span>
            <span>•</span>
            <span>{service.duration_minutes} min</span>
          </div>
        </div>

        <div className="w-full h-px bg-border mb-4" />

        {/* Chamada */}
        <p className="text-xs font-bold text-text-primary text-center mb-3">
          Selecione o dia da semana desejado:
        </p>

        {/* Navegação e Grade 2x3 */}
        <div className="flex items-center justify-between gap-1 mb-4">
          {/* Seta Anterior */}
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
            disabled={weekOffset === 0}
            className="w-7 h-7 rounded-full flex items-center justify-center border border-border bg-brand-lightest text-text-secondary cursor-pointer shrink-0 transition-all duration-200 hover:not-disabled:bg-brand-primary hover:not-disabled:border-brand-primary hover:not-disabled:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:border-transparent"
            aria-label="Semana anterior"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2.5} />
          </button>

          {/* Grade 2x3 */}
          <div className="grid grid-cols-2 gap-2 flex-1 mx-1">
            {displayDays.map((d) => {
              const isSelected = selectedDate === d.dateStr;
              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => {
                    if (!d.isPast) {
                      onSelectDate(d.dateStr);
                    }
                  }}
                  disabled={d.isPast}
                  className={`${diaBtnBase} ${
                    isSelected
                      ? 'bg-brand-primary border-brand-primary text-brand-lightest shadow-[0_1px_2px_rgba(217,108,0,0.2)]'
                      : d.isPast
                      ? 'bg-[rgba(234,222,214,0.3)] border-transparent text-[rgba(112,98,91,0.4)] cursor-not-allowed'
                      : 'border-border hover:not-disabled:border-[rgba(217,108,0,0.6)]'
                  }`}
                >
                  <div className="text-sm font-extrabold leading-[1.2]">
                    {d.dayNumber}
                  </div>
                  <div
                    className="text-[0.6875rem] font-bold mt-0.5"
                    style={{ color: isSelected ? '#FFF1E6' : '#70625B' }}
                  >
                    {d.weekdayName}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Seta Próxima */}
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="w-7 h-7 rounded-full flex items-center justify-center border border-border bg-brand-lightest text-text-secondary cursor-pointer shrink-0 transition-all duration-200 hover:not-disabled:bg-brand-primary hover:not-disabled:border-brand-primary hover:not-disabled:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:border-transparent"
            aria-label="Próxima semana"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2.5} />
          </button>
        </div>

        <p className="text-[0.6875rem] text-text-secondary text-center m-0">
          Toque no dia para escolher barbeiro e horário
        </p>
      </div>
    </div>
  );
};
