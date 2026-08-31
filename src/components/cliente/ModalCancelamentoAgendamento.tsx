import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
import type { AgendamentoCanal } from '../../modules/canal-cliente/types';

export interface ModalCancelamentoAgendamentoProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AgendamentoCanal | null;
  cancelReason: string;
  onChangeReason: (reason: string) => void;
  onConfirmCancel: () => Promise<void>;
  canceling: boolean;
}

export const ModalCancelamentoAgendamento: React.FC<ModalCancelamentoAgendamentoProps> = ({
  isOpen,
  onClose,
  appointment,
  cancelReason,
  onChangeReason,
  onConfirmCancel,
  canceling,
}) => {
  if (!isOpen || !appointment) return null;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${weekdays[date.getDay()]}, ${d}/${m} às ${hours}:${minutes}`;
  };

  return (
    <div className="modal-backdrop-custom">
      <div className="modal-dialog-card" style={{ textAlign: 'center' }}>
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={canceling}
          className="modal-btn-close"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Ícone de Alerta */}
        <div style={{ width: '3rem', height: '3rem', borderRadius: '9999px', backgroundColor: '#FDE8E8', color: '#F05252', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
          <HugeiconsIcon icon={AlertCircleIcon} size={24} strokeWidth={2.5} />
        </div>

        <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#2D231E', margin: 0 }}>
          Deseja cancelar seu horário?
        </h2>

        <p style={{ fontSize: '0.75rem', color: '#70625B', marginTop: '0.375rem', marginBottom: '1rem', lineHeight: 1.4 }}>
          Seu horário para <strong>{appointment.service_name}</strong> na{' '}
          <strong>{formatDateTime(appointment.start_time)}</strong> será liberado para outros clientes.
        </p>

        {/* Campo de Motivo Opcional */}
        <div style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
          <label className="cliente-input-label">
            Motivo do cancelamento (opcional):
          </label>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => onChangeReason(e.target.value)}
            placeholder="Ex: Tive um imprevisto de horário"
            disabled={canceling}
            className="cliente-input"
            style={{ backgroundColor: 'rgba(255, 241, 230, 0.4)' }}
          />
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onConfirmCancel}
            disabled={canceling}
            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800, backgroundColor: '#F05252', color: '#FFFFFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {canceling ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} />
                <span>Cancelando...</span>
              </>
            ) : (
              <span>Sim, confirmar cancelamento</span>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={canceling}
            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#FFFFFF', color: '#2D231E', border: '1px solid #EADED6', cursor: 'pointer' }}
          >
            Não, manter meu agendamento
          </button>
        </div>
      </div>
    </div>
  );
};
