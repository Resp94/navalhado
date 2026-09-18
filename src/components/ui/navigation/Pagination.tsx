import React from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  className = '',
  style,
}) => {
  if (totalPages <= 1 && !totalItems) return null;

  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  return (
    <nav
      aria-label="Paginação"
      className={`flex items-center justify-between flex-wrap gap-4 py-3 font-base text-xs text-text-secondary w-full box-border ${className}`}
      style={style}
    >
      {totalItems !== undefined && (
        <div>
          Total: <strong className="text-text-primary">{totalItems}</strong> {totalItems === 1 ? 'item' : 'itens'}
          {itemsPerPage && totalPages > 1 && (
            <span> • Página {currentPage} de {totalPages}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center gap-[0.35rem] px-3 py-[0.4rem] bg-bg-secondary text-text-primary border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-sm font-inherit text-xs font-bold cursor-pointer transition-[background-color,opacity] duration-150 ease-in min-h-8 hover:not-disabled:bg-black/4 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Página anterior"
          aria-label="Página anterior"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Anterior</span>
        </button>

        <span className="font-bold px-[0.4rem] text-text-primary">
          {currentPage} / {totalPages || 1}
        </span>

        <button
          type="button"
          disabled={isLast}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-[0.35rem] px-3 py-[0.4rem] bg-bg-secondary text-text-primary border-none shadow-[0_0_0_0.8px_var(--color-text-primary)] rounded-sm font-inherit text-xs font-bold cursor-pointer transition-[background-color,opacity] duration-150 ease-in min-h-8 hover:not-disabled:bg-black/4 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Próxima página"
          aria-label="Próxima página"
        >
          <span>Próxima</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </nav>
  );
};
