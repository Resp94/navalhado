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
    <div className="relative overflow-hidden rounded-[1.5rem] p-6 text-white shadow-[0_8px_24px_rgba(45,35,30,0.15)] border border-[rgba(217,108,0,0.2)] bg-[linear-gradient(135deg,#1A120F_0%,#2E2018_50%,#D96C00_100%)]">
      <div className="absolute -top-12 -right-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none blur-[4px]" />

      <div className="relative z-10 flex flex-col items-start gap-2">
        <h2 className="text-lg font-extrabold text-white m-0 tracking-[-0.02em]">
          Precisa de um novo horário?
        </h2>

        <p className="text-xs text-white/90 m-0 leading-[1.4] max-w-[90%]">
          Agende com facilidade. Escolha o serviço, selecione o barbeiro de sua preferência e confirme o seu horário em segundos.
        </p>

        <button
          type="button"
          onClick={onNewBooking}
          className="mt-2 inline-flex items-center justify-between gap-3 py-2 px-4 rounded-full bg-white text-brand-primary text-xs font-extrabold shadow-[0_2px_8px_rgba(0,0,0,0.1)] border-none cursor-pointer transition-all duration-200 hover:bg-brand-lightest"
        >
          <span>Novo agendamento</span>
          <span className="w-5 h-5 rounded-full bg-brand-primary text-white flex items-center justify-center">
            <HugeiconsIcon icon={ArrowRight01Icon} size={12} strokeWidth={2.5} />
          </span>
        </button>
      </div>
    </div>
  );
};
