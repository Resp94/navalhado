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
    <div className="modal-backdrop-custom">
      <div className="modal-dialog-card">
        {/* Botão Voltar */}
        {onBack && !isRescheduling && (
          <button
            type="button"
            onClick={onBack}
            className="modal-btn-back"
            aria-label="Voltar para seleção de dias"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2.5} />
          </button>
        )}

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="modal-btn-close"
          aria-label="Fechar"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.5} />
        </button>

        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', paddingTop: '0.5rem', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#2D231E', margin: 0 }}>
            {service.name}
          </h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: '0.25rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', backgroundColor: '#FFF1E6', border: '1px solid rgba(242, 178, 119, 0.6)', fontSize: '0.75rem', fontWeight: 700, color: '#D96C00' }}>
            {formatDateTitle(selectedDate)}
          </div>
        </div>

        <div style={{ width: '100%', height: '1px', backgroundColor: '#EADED6', marginBottom: '1rem' }} />

        {/* Seletor de Profissional */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2D231E', marginBottom: '0.5rem' }}>
            Selecione o profissional:
          </p>
          <div className="profissionais-stack">
            {/* Opção Qualquer Profissional Livre */}
            <button
              type="button"
              onClick={() => onSelectProfessional(null, 'Qualquer profissional')}
              className={`profissional-btn ${
                selectedProfessional?.id === null ? 'profissional-btn--selected' : ''
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
                  className={`profissional-btn ${
                    isSelected ? 'profissional-btn--selected' : ''
                  }`}
                >
                  {prof.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seletor de Horários */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2D231E', marginBottom: '0.5rem' }}>
            Horários disponíveis:
          </p>

          {loadingSlots ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
              <div className="spinner" style={{ borderTopColor: '#D96C00', borderColor: '#EADED6' }} />
            </div>
          ) : slots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0.75rem', backgroundColor: 'rgba(255, 241, 230, 0.5)', borderRadius: '0.75rem', border: '1px solid #EADED6' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#70625B', margin: 0 }}>
                Nenhum horário disponível para esta data com o profissional selecionado.
              </p>
            </div>
          ) : (
            <div className="slots-grid-3col">
              {slots.map((slot) => {
                const isSelected = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onSelectSlot(slot)}
                    className={`slot-btn ${
                      isSelected ? 'slot-btn--selected' : ''
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
          className="btn-cliente-primary"
        >
          {isRescheduling ? 'Confirmar reagendamento' : 'Avançar para identificação →'}
        </button>
      </div>
    </div>
  );
};
