import React, { useState, useMemo, useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { dateInZone } from '../lib/timezone';

export interface CustomDatePickerProps {
  selectedDate: string;
  timezone?: string;
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
  position?: 'left' | 'right';
  className?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  selectedDate,
  timezone = 'America/Sao_Paulo',
  onSelectDate,
  onClose,
  position = 'right',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentYear, setCurrentYear] = useState(() => {
    const [y] = selectedDate.split('-').map(Number);
    return isNaN(y) ? new Date().getFullYear() : y;
  });

  const [currentMonth, setCurrentMonth] = useState(() => {
    const [, m] = selectedDate.split('-').map(Number);
    return isNaN(m) ? new Date().getMonth() : m - 1;
  });

  // Fechar ao clicar fora ou pressionar Escape
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const todayStr = useMemo(() => dateInZone(new Date(), timezone), [timezone]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const monthLabel = useMemo(() => {
    const d = new Date(currentYear, currentMonth, 1);
    const mName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(d);
    const capitalized = mName.charAt(0).toUpperCase() + mName.slice(1);
    return `${capitalized} ${currentYear}`;
  }, [currentYear, currentMonth]);

  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Domingo
    const daysInCurrMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    // Dias do mês anterior para completar o início da grade (Domingo)
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dNum);
      const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        dayNumber: dNum,
        dateStr,
        isCurrentMonth: false,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
      });
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInCurrMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
      });
    }

    // Dias do próximo mês para completar 35 ou 42 células da grade
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(currentYear, currentMonth + 1, d);
      const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [currentYear, currentMonth, selectedDate, todayStr]);

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div
      ref={containerRef}
      className={`absolute top-[calc(100%+10px)] ${position === 'left' ? 'left-0' : 'right-0'} w-[312px] bg-white rounded-[20px] px-[18px] pt-[18px] pb-5 shadow-[0_16px_40px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.05)] border border-[rgba(0,0,0,0.08)] z-[1100] box-border select-none animate-[fadeIn_0.15s_ease-out] max-[380px]:w-[calc(100vw-24px)] max-[380px]:right-[-12px] max-[380px]:px-3 max-[380px]:pt-4 max-[380px]:pb-[18px] ${className}`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Seletor de data"
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 text-text-primary">
          <span className="text-[1.0625rem] font-bold text-text-primary font-base tracking-[-0.01em]">{monthLabel}</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={15} className="text-[#0084ff] mt-px" />
        </div>

        <div className="flex items-center gap-3.5">
          <button
            type="button"
            className="bg-transparent border-none cursor-pointer p-1 flex items-center justify-center text-[#0084ff] rounded-md transition-colors duration-150 ease-in hover:bg-[rgba(0,132,255,0.08)]"
            onClick={handlePrevMonth}
            aria-label="Mês anterior"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          </button>
          <button
            type="button"
            className="bg-transparent border-none cursor-pointer p-1 flex items-center justify-center text-[#0084ff] rounded-md transition-colors duration-150 ease-in hover:bg-[rgba(0,132,255,0.08)]"
            onClick={handleNextMonth}
            aria-label="Próximo mês"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </button>
        </div>
      </div>

      {/* Linha dos dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-2 w-full box-border">
        {weekdays.map((wd) => (
          <span
            key={wd}
            className="text-center text-[0.8125rem] font-medium text-[#64748b] font-base flex items-center justify-center w-9 mx-auto max-[380px]:w-8 max-[380px]:text-[0.85rem]"
          >
            {wd}
          </span>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-1 [row-gap:6px] w-full box-border">
        {calendarDays.map((item) => {
          const stateClasses = item.isSelected
            ? 'border-[#0084ff] bg-[#e5f2fe] text-[#0070d2] font-bold'
            : item.isToday
              ? 'border-transparent bg-[#f1f5f9] font-semibold text-[#1e293b]'
              : item.isCurrentMonth
                ? 'border-transparent text-[#1e293b] font-medium hover:bg-[#f1f5f9]'
                : 'border-transparent text-[#94a3b8] font-normal hover:bg-[#f1f5f9]';

          return (
            <button
              key={item.dateStr}
              type="button"
              className={`aspect-square w-9 h-9 max-w-full mx-auto rounded-full flex items-center justify-center text-[0.9375rem] bg-transparent border-2 cursor-pointer p-0 outline-none font-base transition-colors duration-[120ms] ease-in box-border max-[380px]:w-8 max-[380px]:h-8 max-[380px]:text-[0.85rem] ${stateClasses}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDate(item.dateStr);
              }}
            >
              {item.dayNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
};
