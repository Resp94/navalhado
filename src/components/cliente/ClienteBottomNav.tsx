import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar02Icon, Scissor01Icon } from '@hugeicons/core-free-icons';

export interface ClienteBottomNavProps {
  activeTab: 'agendar' | 'meus-agendamentos';
  onTabChange: (tab: 'agendar' | 'meus-agendamentos') => void;
}

export const ClienteBottomNav: React.FC<ClienteBottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <nav className="fixed bottom-4 left-0 right-0 z-40 px-4 flex justify-center pointer-events-none">
      <div className="w-full max-w-[360px] bg-white/95 backdrop-blur-md rounded-full border border-[#EADED6] p-1.5 shadow-lg flex items-center justify-between pointer-events-auto">
        {/* Aba 1: Agendar */}
        <button
          type="button"
          onClick={() => onTabChange('agendar')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-full transition-all duration-200 cursor-pointer border ${
            activeTab === 'agendar'
              ? 'bg-[#FFF1E6] border-[#D96C00] text-[#D96C00] font-bold shadow-xs'
              : 'border-transparent text-[#70625B] hover:text-[#2D231E] font-medium'
          }`}
          aria-label="Ir para agendamento"
        >
          <HugeiconsIcon
            icon={Calendar02Icon}
            size={18}
            className={activeTab === 'agendar' ? 'text-[#D96C00]' : 'text-[#70625B]'}
          />
          <span className="text-[11px] mt-0.5 leading-none">Agendar</span>
        </button>

        {/* Aba 2: Meus agendamentos */}
        <button
          type="button"
          onClick={() => onTabChange('meus-agendamentos')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-full transition-all duration-200 cursor-pointer border ${
            activeTab === 'meus-agendamentos'
              ? 'bg-[#FFF1E6] border-[#D96C00] text-[#D96C00] font-bold shadow-xs'
              : 'border-transparent text-[#70625B] hover:text-[#2D231E] font-medium'
          }`}
          aria-label="Ir para meus agendamentos"
        >
          <HugeiconsIcon
            icon={Scissor01Icon}
            size={18}
            className={activeTab === 'meus-agendamentos' ? 'text-[#D96C00]' : 'text-[#70625B]'}
          />
          <span className="text-[11px] mt-0.5 leading-none">Meus agendamentos</span>
        </button>
      </div>
    </nav>
  );
};
