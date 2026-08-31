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
    <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl border border-[#D96C00]/20 bg-linear-to-br from-[#1A120F] via-[#2E2018] to-[#D96C00]">
      {/* Círculo Decorativo Mesh */}
      <div className="absolute -top-12 -right-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none blur-xs" />

      <div className="relative z-10 flex flex-col items-start gap-2">
        <h2 className="text-lg sm:text-xl font-extrabold text-white m-0 tracking-tight">
          Precisa de um novo horário?
        </h2>
        <p className="text-xs text-white/90 m-0 leading-relaxed max-w-[90%]">
          Agende com facilidade. Escolha o serviço, selecione o barbeiro de sua preferência e confirme o seu horário em segundos.
        </p>

        <button
          type="button"
          onClick={onNewBooking}
          className="mt-2 inline-flex items-center justify-between gap-3 py-2 px-4 rounded-full bg-white text-[#D96C00] text-xs font-extrabold shadow-md hover:bg-[#FFF1E6] transition-colors cursor-pointer"
        >
          <span>Novo agendamento</span>
          <span className="w-5 h-5 rounded-full bg-[#D96C00] text-white flex items-center justify-center">
            <HugeiconsIcon icon={ArrowRight01Icon} size={12} strokeWidth={2.5} />
          </span>
        </button>
      </div>
    </div>
  );
};
