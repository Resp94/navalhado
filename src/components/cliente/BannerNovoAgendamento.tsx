import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';

export interface BannerNovoAgendamentoProps {
  onNewBooking: () => void;
}

export const BannerNovoAgendamento: React.FC<BannerNovoAgendamentoProps> = ({
  onNewBooking,
}) => {
  return (
    <div className="banner-novo-agendamento">
      <div style={{ position: 'absolute', top: '-3rem', right: '-2rem', width: '10rem', height: '10rem', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.1)', pointerEvents: 'none', filter: 'blur(4px)' }} />

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
          Precisa de um novo horário?
        </h2>

        <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.9)', margin: 0, lineHeight: 1.4, maxWidth: '90%' }}>
          Agende com facilidade. Escolha o serviço, selecione o barbeiro de sua preferência e confirme o seu horário em segundos.
        </p>

        <button
          type="button"
          onClick={onNewBooking}
          className="banner-novo-agendamento__btn"
        >
          <span>Novo agendamento</span>
          <span style={{ width: '1.25rem', height: '1.25rem', borderRadius: '9999px', backgroundColor: '#D96C00', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HugeiconsIcon icon={ArrowRight01Icon} size={12} strokeWidth={2.5} />
          </span>
        </button>
      </div>
    </div>
  );
};
