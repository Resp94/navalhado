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
    <div className="modal-backdrop-custom">
      <div className="modal-dialog-card">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="modal-btn-close"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Resumo do Serviço */}
        <div style={{ textAlign: 'center', paddingTop: '0.25rem', paddingBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#2D231E', margin: 0 }}>
            {service.name}
          </h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.375rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', backgroundColor: '#FFF1E6', border: '1px solid rgba(242, 178, 119, 0.6)', fontSize: '0.75rem', fontWeight: 700, color: '#D96C00' }}>
            <span>{formattedPrice}</span>
            <span>•</span>
            <span>{service.duration_minutes} min</span>
          </div>
        </div>

        <div style={{ width: '100%', height: '1px', backgroundColor: '#EADED6', marginBottom: '1rem' }} />

        {/* Chamada */}
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2D231E', textAlign: 'center', marginBottom: '0.75rem' }}>
          Selecione o dia da semana desejado:
        </p>

        {/* Navegação e Grade 2x3 */}
        <div className="semana-nav-row">
          {/* Seta Anterior */}
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
            disabled={weekOffset === 0}
            className="semana-nav-btn"
            aria-label="Semana anterior"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2.5} />
          </button>

          {/* Grade 2x3 */}
          <div className="grid-dias-2x3">
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
                  className={`dia-btn ${
                    isSelected
                      ? 'dia-btn--selected'
                      : d.isPast
                      ? 'dia-btn--past'
                      : ''
                  }`}
                >
                  <div className="dia-btn__number">
                    {d.dayNumber}
                  </div>
                  <div
                    className="dia-btn__weekday"
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
            className="semana-nav-btn"
            aria-label="Próxima semana"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2.5} />
          </button>
        </div>

        <p style={{ fontSize: '0.6875rem', color: '#70625B', textAlign: 'center', margin: 0 }}>
          Toque no dia para escolher barbeiro e horário
        </p>
      </div>
    </div>
  );
};
