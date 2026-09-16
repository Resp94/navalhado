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
  const itemBaseClass =
    'flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-full border border-transparent cursor-pointer bg-transparent text-black font-semibold transition-all duration-200';
  const itemActiveClass =
    'bg-brand-lightest border-brand-primary text-black font-bold shadow-[0_1px_2px_rgba(217,108,0,0.15)]';

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-40 px-4 flex justify-center pointer-events-none">
      <div className="w-full max-w-[360px] bg-white/95 backdrop-blur-[8px] rounded-full border border-border p-1.5 shadow-[0_8px_24px_rgba(45,35,30,0.12)] flex items-center justify-between pointer-events-auto box-border">
        {/* Aba 1: Agendar */}
        <button
          type="button"
          onClick={() => onTabChange('agendar')}
          className={`${itemBaseClass} ${activeTab === 'agendar' ? itemActiveClass : ''}`}
          aria-label="Ir para agendamento"
        >
          <HugeiconsIcon
            icon={CalendarAdd01Icon}
            size={18}
            style={{ color: '#000000' }}
          />
          <span className="text-[0.6875rem] mt-0.5 leading-none text-black">Agendar</span>
        </button>

        {/* Aba 2: Meus agendamentos */}
        <button
          type="button"
          onClick={() => onTabChange('meus-agendamentos')}
          className={`${itemBaseClass} ${activeTab === 'meus-agendamentos' ? itemActiveClass : ''}`}
          aria-label="Ir para meus agendamentos"
        >
          <HugeiconsIcon
            icon={CalendarDaysIcon}
            size={18}
            style={{ color: '#000000' }}
          />
          <span className="text-[0.6875rem] mt-0.5 leading-none text-black">Meus agendamentos</span>
        </button>
      </div>
    </nav>
  );
};
