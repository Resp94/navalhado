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
      className={`custom-datepicker-dropdown ${position === 'left' ? 'custom-datepicker-dropdown--left' : ''} ${className}`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Seletor de data"
    >
      {/* Cabeçalho */}
      <div className="custom-datepicker-header">
        <div className="custom-datepicker-title-group">
          <span className="custom-datepicker-title">{monthLabel}</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={15} className="custom-datepicker-chevron" />
        </div>

        <div className="custom-datepicker-arrows">
          <button
            type="button"
            className="custom-datepicker-arrow-btn"
            onClick={handlePrevMonth}
            aria-label="Mês anterior"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          </button>
          <button
            type="button"
            className="custom-datepicker-arrow-btn"
            onClick={handleNextMonth}
            aria-label="Próximo mês"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
          </button>
        </div>
      </div>

      {/* Linha dos dias da semana */}
      <div className="custom-datepicker-weekdays">
        {weekdays.map((wd) => (
          <span key={wd} className="custom-datepicker-weekday">
            {wd}
          </span>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="custom-datepicker-grid">
        {calendarDays.map((item) => {
          let cellClass = 'custom-datepicker-cell';
          if (!item.isCurrentMonth) cellClass += ' custom-datepicker-cell--outside';
          if (item.isSelected) cellClass += ' custom-datepicker-cell--selected';
          else if (item.isToday) cellClass += ' custom-datepicker-cell--today';

          return (
            <button
              key={item.dateStr}
              type="button"
              className={cellClass}
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

      <style>{`
        .custom-datepicker-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 312px;
          background: #ffffff;
          border-radius: 20px;
          padding: 18px 18px 20px 18px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.08);
          z-index: 1100;
          box-sizing: border-box;
          user-select: none;
          animation: datepickerFadeIn 0.15s ease-out;
        }

        .custom-datepicker-dropdown--left {
          right: auto;
          left: 0;
        }

        .dark-theme .custom-datepicker-dropdown {
          background: #1c1917;
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55);
        }

        @keyframes datepickerFadeIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .custom-datepicker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .custom-datepicker-title-group {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--color-text-primary, #1e293b);
        }

        .custom-datepicker-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--color-text-primary, #1e293b);
          font-family: var(--font-family-base);
          letter-spacing: -0.01em;
        }

        .dark-theme .custom-datepicker-title {
          color: #ffffff;
        }

        .custom-datepicker-chevron {
          color: #0084ff;
          margin-top: 1px;
        }

        .custom-datepicker-arrows {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .custom-datepicker-arrow-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0084ff;
          border-radius: 6px;
          transition: background-color 0.15s ease, opacity 0.15s ease;
        }

        .custom-datepicker-arrow-btn:hover {
          background-color: rgba(0, 132, 255, 0.08);
        }

        .custom-datepicker-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          margin-bottom: 8px;
          width: 100%;
          box-sizing: border-box;
        }

        .custom-datepicker-weekday {
          text-align: center;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #64748b;
          font-family: var(--font-family-base);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          margin: 0 auto;
        }

        .dark-theme .custom-datepicker-weekday {
          color: #a8a29e;
        }

        .custom-datepicker-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          row-gap: 6px;
          width: 100%;
          box-sizing: border-box;
        }

        .custom-datepicker-cell {
          aspect-ratio: 1;
          width: 36px;
          height: 36px;
          max-width: 100%;
          margin: 0 auto;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9375rem;
          font-weight: 500;
          color: #1e293b;
          background: transparent;
          border: 2px solid transparent;
          cursor: pointer;
          padding: 0;
          outline: none;
          font-family: var(--font-family-base);
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
          box-sizing: border-box;
        }

        .dark-theme .custom-datepicker-cell {
          color: #f5f5f4;
        }

        .custom-datepicker-cell:hover {
          background-color: #f1f5f9;
        }

        .dark-theme .custom-datepicker-cell:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }

        .custom-datepicker-cell--outside {
          color: #94a3b8;
          font-weight: 400;
        }

        .dark-theme .custom-datepicker-cell--outside {
          color: #78716c;
        }

        .custom-datepicker-cell--today {
          background-color: #f1f5f9;
          font-weight: 600;
        }

        .dark-theme .custom-datepicker-cell--today {
          background-color: rgba(255, 255, 255, 0.08);
        }

        /* Selected Day: Anel azul com preenchimento suave */
        .custom-datepicker-cell--selected {
          border: 2px solid #0084ff !important;
          background-color: #e5f2fe !important;
          color: #0070d2 !important;
          font-weight: 700 !important;
        }

        .dark-theme .custom-datepicker-cell--selected {
          border-color: #38bdf8 !important;
          background-color: rgba(56, 189, 248, 0.22) !important;
          color: #38bdf8 !important;
        }

        @media (max-width: 380px) {
          .custom-datepicker-dropdown {
            width: calc(100vw - 24px);
            right: -12px;
            padding: 16px 12px 18px 12px;
          }
          .custom-datepicker-weekday,
          .custom-datepicker-cell {
            width: 32px;
            height: 32px;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
};
