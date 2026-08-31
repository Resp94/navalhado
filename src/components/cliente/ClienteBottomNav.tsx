import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CalendarAdd01Icon, CalendarDaysIcon } from '@hugeicons/core-free-icons';

export interface ClienteBottomNavProps {
  activeTab: 'agendar' | 'meus-agendamentos';
  onTabChange: (tab: 'agendar' | 'meus-agendamentos') => void;
}

export const ClienteBottomNav: React.FC<ClienteBottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <nav className="cliente-bottom-nav">
      <div className="cliente-bottom-nav__pill">
        {/* Aba 1: Agendar */}
        <button
          type="button"
          onClick={() => onTabChange('agendar')}
          className={`cliente-bottom-nav__item ${
            activeTab === 'agendar' ? 'cliente-bottom-nav__item--active' : ''
          }`}
          aria-label="Ir para agendamento"
        >
          <HugeiconsIcon
            icon={CalendarAdd01Icon}
            size={18}
            style={{ color: '#000000' }}
          />
          <span className="cliente-bottom-nav__label">Agendar</span>
        </button>

        {/* Aba 2: Meus agendamentos */}
        <button
          type="button"
          onClick={() => onTabChange('meus-agendamentos')}
          className={`cliente-bottom-nav__item ${
            activeTab === 'meus-agendamentos' ? 'cliente-bottom-nav__item--active' : ''
          }`}
          aria-label="Ir para meus agendamentos"
        >
          <HugeiconsIcon
            icon={CalendarDaysIcon}
            size={18}
            style={{ color: '#000000' }}
          />
          <span className="cliente-bottom-nav__label">Meus agendamentos</span>
        </button>
      </div>
    </nav>
  );
};
