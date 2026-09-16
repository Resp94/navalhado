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
    <>
      <nav aria-label="Paginação" className={`ui-pagination ${className}`} style={style}>
        {totalItems !== undefined && (
          <div className="ui-pagination-info">
            Total: <strong>{totalItems}</strong> {totalItems === 1 ? 'item' : 'itens'}
            {itemsPerPage && totalPages > 1 && (
              <span className="ui-pagination-sub">
                {' '}• Página {currentPage} de {totalPages}
              </span>
            )}
          </div>
        )}

        <div className="ui-pagination-controls">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onPageChange(currentPage - 1)}
            className="ui-pagination-btn"
            title="Página anterior"
            aria-label="Página anterior"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Anterior</span>
          </button>

          <span className="ui-pagination-current">
            {currentPage} / {totalPages || 1}
          </span>

          <button
            type="button"
            disabled={isLast}
            onClick={() => onPageChange(currentPage + 1)}
            className="ui-pagination-btn"
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

      <style>{`
        .ui-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 0.75rem 0;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          font-size: var(--font-size-xs, 0.75rem);
          color: var(--color-text-secondary, #70625B);
          width: 100%;
          box-sizing: border-box;
        }

        .ui-pagination-info strong {
          color: var(--color-text-primary, #2D231E);
        }

        .dark-theme .ui-pagination-info strong {
          color: var(--color-text-primary, #FFF1E6);
        }

        .ui-pagination-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-left: auto;
        }

        .ui-pagination-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 0.75rem;
          background-color: var(--color-bg-secondary, #FFFFFF);
          color: var(--color-text-primary, #2D231E);
          border: none;
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-sm, 6px);
          font-family: inherit;
          font-size: var(--font-size-xs, 0.75rem);
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.15s ease, opacity 0.15s ease;
          min-height: 32px;
        }

        .dark-theme .ui-pagination-btn {
          background-color: var(--color-bg-secondary, #1E1B18);
          color: var(--color-text-primary, #FFF1E6);
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
        }

        .ui-pagination-btn:hover:not(:disabled) {
          background-color: rgba(0, 0, 0, 0.04);
        }

        .dark-theme .ui-pagination-btn:hover:not(:disabled) {
          background-color: rgba(255, 255, 255, 0.06);
        }

        .ui-pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .ui-pagination-current {
          font-weight: 700;
          padding: 0 0.4rem;
          color: var(--color-text-primary, #2D231E);
        }

        .dark-theme .ui-pagination-current {
          color: var(--color-text-primary, #FFF1E6);
        }
      `}</style>
    </>
  );
};
