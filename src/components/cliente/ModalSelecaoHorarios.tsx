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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-xs">
      <div className="w-full max-w-[390px] max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-[#EADED6] p-6 shadow-2xl relative">
        {/* Botão Voltar */}
        {onBack && !isRescheduling && (
          <button
            type="button"
            onClick={onBack}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-[#FFF1E6] hover:bg-[#F2B277]/40 flex items-center justify-center text-[#70625B] transition-colors border border-[#EADED6] cursor-pointer"
            aria-label="Voltar para seleção de dias"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2.5} />
          </button>
        )}

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FFF1E6] hover:bg-[#F2B277]/40 flex items-center justify-center text-[#70625B] transition-colors border border-[#EADED6] cursor-pointer"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Cabeçalho */}
        <div className="text-center pt-2 pb-3">
          <h2 className="text-base font-extrabold text-[#2D231E] m-0 tracking-tight">
            {service.name}
          </h2>
          <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-0.5 rounded-full bg-[#FFF1E6] border border-[#F2B277]/60 text-xs font-bold text-[#D96C00]">
            {formatDateTitle(selectedDate)}
          </div>
        </div>

        <div className="w-full h-px bg-[#EADED6] mb-4" />

        {/* Seletor de Profissional */}
        <div className="mb-4">
          <p className="text-xs font-bold text-[#2D231E] mb-2">
            Selecione o profissional:
          </p>
          <div className="flex flex-col gap-1.5">
            {/* Opção Qualquer Profissional Livre */}
            <button
              type="button"
              onClick={() => onSelectProfessional(null, 'Qualquer profissional')}
              className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                selectedProfessional?.id === null
                  ? 'bg-[#D96C00] border-[#D96C00] text-[#FFF1E6] shadow-xs'
                  : 'bg-white border-[#EADED6] text-[#2D231E] hover:border-[#D96C00]/60'
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
                  className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#D96C00] border-[#D96C00] text-[#FFF1E6] shadow-xs'
                      : 'bg-white border-[#EADED6] text-[#2D231E] hover:border-[#D96C00]/60'
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
          <p className="text-xs font-bold text-[#2D231E] mb-2">
            Horários disponíveis:
          </p>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#EADED6] border-t-[#D96C00] rounded-full animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-6 px-3 bg-[#FFF1E6]/50 rounded-xl border border-[#EADED6]">
              <p className="text-xs font-semibold text-[#70625B] m-0">
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
                    className={`py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0E9F6E] border-[#0E9F6E] text-white shadow-xs'
                        : 'bg-white border-[#EADED6] text-[#2D231E] hover:border-[#0E9F6E]/60'
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
          className={`w-full py-3 px-4 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
            selectedSlot
              ? 'bg-[#D96C00] text-[#FFF1E6] hover:bg-[#9C3F00] shadow-md'
              : 'bg-[#EADED6] text-[#70625B]/60 cursor-not-allowed'
          }`}
        >
          {isRescheduling ? 'Confirmar reagendamento' : 'Avançar para identificação →'}
        </button>
      </div>
    </div>
  );
};
