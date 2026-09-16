import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import type { ServicoCanal, ProfissionalCanal } from '../../modules/canal-cliente/types';

export interface ModalSelecaoHorariosProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  service: ServicoCanal | null;
  selectedDate: string;
  professionals: ProfissionalCanal[];
  selectedProfessional: { id: string | null; name: string } | null;
  onSelectProfessional: (id: string | null, name: string) => void;
  slots: string[];
  loadingSlots: boolean;
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  onAdvance: () => void;
  isRescheduling?: boolean;
}

export const ModalSelecaoHorarios: React.FC<ModalSelecaoHorariosProps> = ({
  isOpen,
  onClose,
  onBack,
  service,
  selectedDate,
  professionals,
  selectedProfessional,
  onSelectProfessional,
  slots,
  loadingSlots,
  selectedSlot,
  onSelectSlot,
  onAdvance,
  isRescheduling = false,
}) => {
  if (!isOpen || !service) return null;

  const formatDateTitle = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dObj = new Date(y, m - 1, d);
    const dayName = weekdays[dObj.getDay()];
    const dayFormatted = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    return `${dayName} • ${dayFormatted}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(20,17,15,0.6)] backdrop-blur-[4px] box-border">
      <div className="w-full max-w-[390px] max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-border p-6 shadow-[0_16px_48px_rgba(45,35,30,0.2)] relative box-border">
        {/* Botão Voltar */}
        {onBack && !isRescheduling && (
          <button
            type="button"
            onClick={onBack}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-brand-lightest border border-border text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-brand-soft hover:text-text-primary"
            aria-label="Voltar para seleção de dias"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2.5} />
          </button>
        )}

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-brand-lightest border border-border text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-brand-soft hover:text-text-primary"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Cabeçalho */}
        <div className="text-center pt-2 pb-3">
          <h2 className="text-base font-extrabold text-text-primary m-0">
            {service.name}
          </h2>
          <div className="inline-flex items-center mt-1 py-1 px-3 rounded-full bg-brand-lightest border border-[rgba(242,178,119,0.6)] text-xs font-bold text-brand-primary">
            {formatDateTitle(selectedDate)}
          </div>
        </div>

        <div className="w-full h-px bg-border mb-4" />

        {/* Seletor de Profissional */}
        <div className="mb-4">
          <p className="text-xs font-bold text-text-primary mb-2">
            Selecione o profissional:
          </p>
          <div className="flex flex-col gap-1.5">
            {/* Opção Qualquer Profissional Livre */}
            <button
              type="button"
              onClick={() => onSelectProfessional(null, 'Qualquer profissional')}
              className={`w-full py-[0.625rem] px-[0.875rem] rounded-xl border bg-white text-xs font-bold text-left cursor-pointer transition-all duration-200 ${
                selectedProfessional?.id === null
                  ? 'bg-brand-primary border-brand-primary text-brand-lightest shadow-[0_1px_2px_rgba(217,108,0,0.2)]'
                  : 'border-border text-text-primary hover:border-[rgba(217,108,0,0.6)]'
              }`}
            >
              Qualquer profissional livre
            </button>

            {/* Lista de Barbeiros Reais */}
            {professionals.map((prof) => {
              const isSelected = selectedProfessional?.id === prof.id;
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => onSelectProfessional(prof.id, prof.name)}
                  className={`w-full py-[0.625rem] px-[0.875rem] rounded-xl border bg-white text-xs font-bold text-left cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-brand-primary border-brand-primary text-brand-lightest shadow-[0_1px_2px_rgba(217,108,0,0.2)]'
                      : 'border-border text-text-primary hover:border-[rgba(217,108,0,0.6)]'
                  }`}
                >
                  {prof.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seletor de Horários */}
        <div className="mb-6">
          <p className="text-xs font-bold text-text-primary mb-2">
            Horários disponíveis:
          </p>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <div className="spinner" style={{ borderTopColor: '#D96C00', borderColor: '#EADED6' }} />
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-6 px-3 bg-[rgba(255,241,230,0.5)] rounded-xl border border-border">
              <p className="text-xs font-semibold text-text-secondary m-0">
                Nenhum horário disponível para esta data com o profissional selecionado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => {
                const isSelected = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onSelectSlot(slot)}
                    className={`p-2 rounded-xl text-xs font-extrabold border bg-white cursor-pointer transition-all duration-200 text-center ${
                      isSelected
                        ? 'bg-success border-success text-white shadow-[0_1px_2px_rgba(14,159,110,0.2)]'
                        : 'border-border text-text-primary hover:border-[rgba(14,159,110,0.6)]'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Botão de Avanço */}
        <button
          type="button"
          onClick={onAdvance}
          disabled={!selectedSlot}
          className="w-full py-3 px-4 rounded-full text-xs font-extrabold bg-brand-primary text-brand-lightest border-none cursor-pointer shadow-[0_4px_12px_rgba(217,108,0,0.2)] transition-all duration-200 flex items-center justify-center gap-2 hover:not-disabled:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRescheduling ? 'Confirmar reagendamento' : 'Avançar para identificação →'}
        </button>
      </div>
    </div>
  );
};
