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
    <div className="modal-backdrop-custom">
      <div className="modal-dialog-card">
        {/* Botão Voltar */}
        <button
          type="button"
          onClick={onBack}
          disabled={booking}
          className="modal-btn-back"
          aria-label="Voltar para seleção de horário"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={booking}
          className="modal-btn-close"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', paddingTop: '0.5rem', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#000000', margin: 0 }}>
            Resumo do agendamento
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#70625B', marginTop: '0.125rem', marginBottom: 0 }}>
            Confira os dados antes de finalizar o seu horário.
          </p>
        </div>

        {/* Comanda Box Limpa (Sem fundo bege, textos em preto e negrito, ícones ampliados) */}
        <div className="comanda-box">
          <div className="comanda-row">
            <span className="comanda-row__label">
              <HugeiconsIcon icon={AirplaneSeatIcon} size={18} style={{ color: '#000000' }} />
              Serviço:
            </span>
            <span className="comanda-row__value">
              {service.name} ({formattedPrice})
            </span>
          </div>

          <div className="comanda-row">
            <span className="comanda-row__label">
              <HugeiconsIcon icon={UserIcon} size={18} style={{ color: '#000000' }} />
              Profissional:
            </span>
            <span className="comanda-row__value">
              {selectedProfessional?.name || 'Qualquer profissional livre'}
            </span>
          </div>

          <div className="comanda-row">
            <span className="comanda-row__label">
              <HugeiconsIcon icon={Calendar02Icon} size={18} style={{ color: '#000000' }} />
              Data:
            </span>
            <span className="comanda-row__value">
              {formatDateDisplay(selectedDate)}
            </span>
          </div>

          <div className="comanda-row">
            <span className="comanda-row__label">
              <HugeiconsIcon icon={AlarmClockCheckIcon} size={18} style={{ color: '#000000' }} />
              Horário:
            </span>
            <span className="comanda-row__value">
              {selectedSlot} ({service.duration_minutes} min)
            </span>
          </div>
        </div>

        {/* Formulário de Identificação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="cliente-input-group">
            <label className="cliente-input-label">
              Nome e sobrenome *
            </label>
            <input
              type="text"
              value={clientFullName}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="Ex: Jonathas Lopes"
              disabled={booking}
              className="cliente-input"
            />
          </div>

          <div className="cliente-input-group">
            <label className="cliente-input-label">
              Telefone / WhatsApp com DDD *
            </label>
            <input
              type="tel"
              value={clientPhone}
              onChange={(e) => onChangePhone(e.target.value)}
              placeholder="(92) 99420-4756"
              disabled={booking}
              className="cliente-input"
              style={{ borderColor: '#D96C00' }}
            />
          </div>

          <p style={{ fontSize: '0.6875rem', color: '#70625B', textAlign: 'center', margin: 0, lineHeight: 1.3 }}>
            Enviaremos a confirmação e o lembrete direto no seu WhatsApp.
          </p>
        </div>

        {/* Botão Confirmar Agendamento */}
        <button
          type="button"
          onClick={onConfirmBooking}
          disabled={booking}
          className="btn-cliente-primary"
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
