import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  ArrowLeft01Icon,
  Scissor01Icon,
  UserIcon,
  Calendar02Icon,
  Time01Icon,
  CreditCardIcon,
} from '@hugeicons/core-free-icons';
import type { ServicoCanal } from '../../modules/canal-cliente/types';

export interface ModalResumoAgendamentoProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  service: ServicoCanal | null;
  selectedProfessional: { id: string | null; name: string } | null;
  selectedDate: string;
  selectedSlot: string | null;
  clientFullName: string;
  onChangeName: (name: string) => void;
  clientPhone: string;
  onChangePhone: (phone: string) => void;
  onConfirmBooking: () => void;
  booking: boolean;
}

export const ModalResumoAgendamento: React.FC<ModalResumoAgendamentoProps> = ({
  isOpen,
  onClose,
  onBack,
  service,
  selectedProfessional,
  selectedDate,
  selectedSlot,
  clientFullName,
  onChangeName,
  clientPhone,
  onChangePhone,
  onConfirmBooking,
  booking,
}) => {
  if (!isOpen || !service || !selectedSlot) return null;

  const formattedPrice = Number(service.price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dObj = new Date(y, m - 1, d);
    const dayName = weekdays[dObj.getDay()];
    const dayFormatted = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    return `${dayName}, ${dayFormatted}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-xs">
      <div className="w-full max-w-[390px] max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-[#EADED6] p-6 shadow-2xl relative">
        {/* Botão Voltar */}
        <button
          type="button"
          onClick={onBack}
          disabled={booking}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-[#FFF1E6] hover:bg-[#F2B277]/40 flex items-center justify-center text-[#70625B] transition-colors border border-[#EADED6] cursor-pointer disabled:opacity-50"
          aria-label="Voltar para seleção de horário"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={booking}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FFF1E6] hover:bg-[#F2B277]/40 flex items-center justify-center text-[#70625B] transition-colors border border-[#EADED6] cursor-pointer disabled:opacity-50"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Cabeçalho */}
        <div className="text-center pt-2 pb-3">
          <h2 className="text-base font-extrabold text-[#2D231E] m-0 tracking-tight">
            Resumo do agendamento
          </h2>
          <p className="text-xs text-[#70625B] mt-0.5 mb-0">
            Confira os dados antes de finalizar o seu horário.
          </p>
        </div>

        {/* Comanda Box */}
        <div className="bg-[#FFF1E6]/60 rounded-2xl border border-[#EADED6] p-4 mb-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-[#70625B] font-medium">
              <HugeiconsIcon icon={Scissor01Icon} size={14} className="text-[#70625B]" />
              Serviço:
            </span>
            <span className="font-bold text-[#2D231E]">
              {service.name} ({formattedPrice})
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-[#70625B] font-medium">
              <HugeiconsIcon icon={UserIcon} size={14} className="text-[#70625B]" />
              Profissional:
            </span>
            <span className="font-bold text-[#2D231E]">
              {selectedProfessional?.name || 'Qualquer profissional livre'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-[#70625B] font-medium">
              <HugeiconsIcon icon={Calendar02Icon} size={14} className="text-[#70625B]" />
              Data:
            </span>
            <span className="font-bold text-[#2D231E]">
              {formatDateDisplay(selectedDate)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-[#70625B] font-medium">
              <HugeiconsIcon icon={Time01Icon} size={14} className="text-[#70625B]" />
              Horário:
            </span>
            <span className="font-bold text-[#2D231E]">
              {selectedSlot} ({service.duration_minutes} min)
            </span>
          </div>
        </div>

        {/* Formulário de Identificação */}
        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-[#2D231E] uppercase tracking-wider mb-1">
              Nome e sobrenome *
            </label>
            <input
              type="text"
              value={clientFullName}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="Ex: Jonathas Lopes"
              disabled={booking}
              className="w-full py-2.5 px-3.5 rounded-xl border border-[#EADED6] focus:border-[#D96C00] focus:outline-hidden text-xs font-semibold text-[#2D231E] bg-white transition-colors disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#2D231E] uppercase tracking-wider mb-1">
              Telefone / WhatsApp com DDD *
            </label>
            <input
              type="tel"
              value={clientPhone}
              onChange={(e) => onChangePhone(e.target.value)}
              placeholder="(92) 99420-4756"
              disabled={booking}
              className="w-full py-2.5 px-3.5 rounded-xl border border-[#D96C00] focus:border-[#D96C00] focus:outline-hidden text-xs font-semibold text-[#2D231E] bg-white transition-colors disabled:bg-gray-100"
            />
          </div>

          <p className="text-[11px] text-[#70625B] text-center m-0 leading-tight">
            Enviaremos a confirmação e o lembrete direto no seu WhatsApp.
          </p>
        </div>

        {/* Card Pagamento Presencial */}
        <div className="bg-[#E6F4EA]/80 border border-[#0E9F6E]/40 rounded-xl p-3 mb-5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#0E9F6E]">
            <HugeiconsIcon icon={CreditCardIcon} size={15} />
            <span>Pagamento presencial no estabelecimento</span>
          </div>
          <p className="text-[11px] text-[#2D231E] mt-0.5 mb-0">
            Aceitamos PIX, cartões de crédito e débito
          </p>
        </div>

        {/* Botão Confirmar Agendamento */}
        <button
          type="button"
          onClick={onConfirmBooking}
          disabled={booking}
          className="w-full py-3 px-4 rounded-full text-xs font-extrabold bg-[#D96C00] hover:bg-[#9C3F00] text-[#FFF1E6] shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {booking ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Confirmando...</span>
            </>
          ) : (
            <span>Confirmar agendamento →</span>
          )}
        </button>
      </div>
    </div>
  );
};
