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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-xs">
      <div className="w-full max-w-[390px] bg-white rounded-3xl border border-[#EADED6] p-6 shadow-2xl relative">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FFF1E6] hover:bg-[#F2B277]/40 flex items-center justify-center text-[#70625B] transition-colors border border-[#EADED6] cursor-pointer"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Resumo do Serviço */}
        <div className="text-center pt-1 pb-4">
          <h2 className="text-base font-extrabold text-[#2D231E] m-0 tracking-tight">
            {service.name}
          </h2>
          <div className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-0.5 rounded-full bg-[#FFF1E6] border border-[#F2B277]/60 text-xs font-bold text-[#D96C00]">
            <span>{formattedPrice}</span>
            <span>•</span>
            <span>{service.duration_minutes} min</span>
          </div>
        </div>

        <div className="w-full h-px bg-[#EADED6] mb-4" />

        {/* Chamada */}
        <p className="text-xs font-bold text-[#2D231E] text-center mb-3">
          Selecione o dia da semana desejado:
        </p>

        {/* Navegação e Grade 2x3 */}
        <div className="relative flex items-center justify-between gap-1 mb-4">
          {/* Seta Anterior */}
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
            disabled={weekOffset === 0}
            className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors cursor-pointer shrink-0 ${
              weekOffset === 0
                ? 'opacity-30 border-transparent text-[#70625B] cursor-not-allowed'
                : 'bg-[#FFF1E6] border-[#EADED6] text-[#70625B] hover:bg-[#D96C00] hover:text-white'
            }`}
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
                  className={`py-2.5 px-2 rounded-xl text-center transition-all duration-200 border cursor-pointer ${
                    isSelected
                      ? 'bg-[#D96C00] border-[#D96C00] text-[#FFF1E6] shadow-xs'
                      : d.isPast
                      ? 'bg-[#EADED6]/30 border-transparent text-[#70625B]/40 cursor-not-allowed'
                      : 'bg-white border-[#EADED6] text-[#2D231E] hover:border-[#D96C00]/60'
                  }`}
                >
                  <div className="text-sm font-extrabold leading-tight">
                    {d.dayNumber}
                  </div>
                  <div
                    className={`text-[11px] font-bold mt-0.5 ${
                      isSelected ? 'text-[#FFF1E6]/90' : 'text-[#70625B]'
                    }`}
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
            className="w-7 h-7 rounded-full bg-[#FFF1E6] border border-[#EADED6] text-[#70625B] hover:bg-[#D96C00] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Próxima semana"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2.5} />
          </button>
        </div>

        <p className="text-[11px] text-[#70625B] text-center m-0">
          Toque no dia para escolher barbeiro e horário
        </p>
      </div>
    </div>
  );
};
