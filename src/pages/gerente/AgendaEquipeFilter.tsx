import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { FilterIcon } from '@hugeicons/core-free-icons';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '../../components/ui';
import type { Professional } from './Agenda';

export interface AgendaEquipeFilterProps {
  professionals: Professional[];
  selectedProfessionalIds: string[];
  onToggleProfessional: (profId: string) => void;
  onSelectAllProfessionals: () => void;
}

export const AgendaEquipeFilter: React.FC<AgendaEquipeFilterProps> = ({
  professionals,
  selectedProfessionalIds,
  onToggleProfessional,
  onSelectAllProfessionals,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-32 min-w-32 h-9 inline-flex items-center justify-center gap-1.5 px-2 bg-white/80 border border-border rounded-md text-xs font-semibold text-text-primary cursor-pointer transition-all duration-200 box-border whitespace-nowrap hover:border-brand-primary data-[state=open]:border-brand-primary"
          title="Filtrar Equipe"
          aria-label="Filtrar Equipe"
        >
          <HugeiconsIcon icon={FilterIcon} size={16} aria-hidden="true" />
          <span>Equipe ({selectedProfessionalIds.length})</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent aria-label="Filtrar Barbeiros da Equipe">
        <div className="flex items-center justify-between px-[0.35rem] pb-[0.4rem] border-b border-border">
          <span className="text-xs font-extrabold text-text-secondary uppercase tracking-[0.04em]">
            Exibir Barbeiros
          </span>
          <button
            type="button"
            onClick={onSelectAllProfessionals}
            className="text-xs font-bold text-brand-primary hover:underline"
            aria-label="Selecionar todos os barbeiros"
          >
            Todos
          </button>
        </div>

        <div className="flex flex-col gap-[0.2rem] max-h-[200px] overflow-y-auto" aria-label="Barbeiros disponíveis">
          {professionals.map((prof) => {
            const isChecked = selectedProfessionalIds.includes(prof.id);
            return (
              <DropdownMenuCheckboxItem
                key={prof.id}
                checked={isChecked}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => onToggleProfessional(prof.id)}
              >
                {prof.name}
              </DropdownMenuCheckboxItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
