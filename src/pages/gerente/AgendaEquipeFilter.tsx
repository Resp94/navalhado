import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { FilterIcon } from '@hugeicons/core-free-icons';
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fechar dropdown ao clicar fora ou pressionar ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className="agenda-filter-container" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`btn-agenda-filter ${isOpen ? 'btn-agenda-filter--active' : ''}`}
        onClick={handleToggle}
        title="Filtrar Equipe"
        aria-label="Filtrar Equipe"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <HugeiconsIcon icon={FilterIcon} size={16} aria-hidden="true" />
        <span>Equipe ({selectedProfessionalIds.length})</span>
      </button>

      {isOpen && (
        <div
          className="agenda-filter-dropdown"
          role="dialog"
          aria-label="Filtrar Barbeiros da Equipe"
        >
          <div className="agenda-filter-dropdown__header">
            <strong>Exibir Barbeiros</strong>
            <button
              type="button"
              onClick={onSelectAllProfessionals}
              className="btn-link-xs"
              aria-label="Selecionar todos os barbeiros"
            >
              Todos
            </button>
          </div>

          <div
            className="agenda-filter-dropdown__list"
            aria-label="Barbeiros disponíveis"
          >
            {professionals.map((prof) => {
              const isChecked = selectedProfessionalIds.includes(prof.id);
              return (
                <label key={prof.id} className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleProfessional(prof.id)}
                  />
                  <span>{prof.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
