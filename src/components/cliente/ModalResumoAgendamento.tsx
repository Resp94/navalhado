import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  ArrowLeft01Icon,
  AirplaneSeatIcon,
  UserIcon,
  Calendar02Icon,
  AlarmClockCheckIcon,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(20,17,15,0.6)] backdrop-blur-[4px] box-border">
      <div className="w-full max-w-[390px] max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-border p-6 shadow-[0_16px_48px_rgba(45,35,30,0.2)] relative box-border">
        {/* Botão Voltar */}
        <button
          type="button"
          onClick={onBack}
          disabled={booking}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-brand-lightest border border-border text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-brand-soft hover:text-text-primary"
          aria-label="Voltar para seleção de horário"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={booking}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-brand-lightest border border-border text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-brand-soft hover:text-text-primary"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Cabeçalho */}
        <div className="text-center pt-2 pb-3">
          <h2 className="text-lg font-extrabold text-black m-0">
            Resumo do agendamento
          </h2>
          <p className="text-xs text-text-secondary mt-0.5 mb-0">
            Confira os dados antes de finalizar o seu horário.
          </p>
        </div>

        {/* Comanda Box Limpa (Sem fundo bege, textos em preto e negrito, ícones ampliados) */}
        <div className="bg-transparent border-none py-1 mb-5 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[0.8125rem]">
            <span className="flex items-center gap-2 text-black font-bold">
              <HugeiconsIcon icon={AirplaneSeatIcon} size={18} style={{ color: '#000000' }} />
              Serviço:
            </span>
            <span className="font-extrabold text-black text-right">
              {service.name} ({formattedPrice})
            </span>
          </div>

          <div className="flex items-center justify-between text-[0.8125rem]">
            <span className="flex items-center gap-2 text-black font-bold">
              <HugeiconsIcon icon={UserIcon} size={18} style={{ color: '#000000' }} />
              Profissional:
            </span>
            <span className="font-extrabold text-black text-right">
              {selectedProfessional?.name || 'Qualquer profissional livre'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[0.8125rem]">
            <span className="flex items-center gap-2 text-black font-bold">
              <HugeiconsIcon icon={Calendar02Icon} size={18} style={{ color: '#000000' }} />
              Data:
            </span>
            <span className="font-extrabold text-black text-right">
              {formatDateDisplay(selectedDate)}
            </span>
          </div>

          <div className="flex items-center justify-between text-[0.8125rem]">
            <span className="flex items-center gap-2 text-black font-bold">
              <HugeiconsIcon icon={AlarmClockCheckIcon} size={18} style={{ color: '#000000' }} />
              Horário:
            </span>
            <span className="font-extrabold text-black text-right">
              {selectedSlot} ({service.duration_minutes} min)
            </span>
          </div>
        </div>

        {/* Formulário de Identificação */}
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-[0.6875rem] font-bold text-text-primary uppercase tracking-[0.05em]">
              Nome e sobrenome *
            </label>
            <input
              type="text"
              value={clientFullName}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="Ex: Jonathas Lopes"
              disabled={booking}
              className="w-full py-[0.625rem] px-[0.875rem] rounded-xl border border-border text-xs font-semibold text-text-primary bg-white transition-colors duration-200 box-border focus:border-brand-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[0.6875rem] font-bold text-text-primary uppercase tracking-[0.05em]">
              Telefone / WhatsApp com DDD *
            </label>
            <input
              type="tel"
              value={clientPhone}
              onChange={(e) => onChangePhone(e.target.value)}
              placeholder="(92) 99420-4756"
              disabled={booking}
              className="w-full py-[0.625rem] px-[0.875rem] rounded-xl border border-brand-primary text-xs font-semibold text-text-primary bg-white transition-colors duration-200 box-border focus:border-brand-primary focus:outline-none"
            />
          </div>

          <p className="text-[0.6875rem] text-text-secondary text-center m-0 leading-[1.3]">
            Enviaremos a confirmação e o lembrete direto no seu WhatsApp.
          </p>
        </div>

        {/* Botão Confirmar Agendamento */}
        <button
          type="button"
          onClick={onConfirmBooking}
          disabled={booking}
          className="w-full py-3 px-4 rounded-full text-xs font-extrabold bg-brand-primary text-brand-lightest border-none cursor-pointer shadow-[0_4px_12px_rgba(217,108,0,0.2)] transition-all duration-200 flex items-center justify-center gap-2 hover:not-disabled:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {booking ? (
            <>
              <div className="spinner" style={{ width: 14, height: 14 }} />
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
