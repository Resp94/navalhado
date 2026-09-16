import React from 'react';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <>
      <div className="ui-table-container">
        <div className="ui-table-responsive">
          <table className={`ui-table ${className}`} style={style} {...props}>
            {children}
          </table>
        </div>
      </div>

      <style>{`
        .ui-table-container {
          width: 100%;
          border-radius: var(--radius-lg, 12px);
          background-color: var(--color-bg-secondary, #FFFFFF);
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E), var(--shadow-sm);
          overflow: hidden;
          box-sizing: border-box;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
        }

        .dark-theme .ui-table-container {
          background-color: var(--color-bg-secondary, #1E1B18);
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
        }

        .ui-table-responsive {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .ui-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: var(--font-size-sm, 0.875rem);
        }
      `}</style>
    </>
  );
};

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <thead className={`ui-table-header ${className}`} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <tbody className={`ui-table-body ${className}`} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <>
      <tr className={`ui-table-row ${className}`} style={style} {...props}>
        {children}
      </tr>

      <style>{`
        .ui-table-row {
          transition: background-color 0.12s ease;
          border-bottom: 1px solid var(--color-border, #EADED6);
        }

        .dark-theme .ui-table-row {
          border-bottom-color: var(--color-border, #332D29);
        }

        .ui-table-row:last-child {
          border-bottom: none;
        }

        .ui-table-body .ui-table-row:hover {
          background-color: rgba(45, 35, 30, 0.02);
        }

        .dark-theme .ui-table-body .ui-table-row:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }
      `}</style>
    </>
  );
};

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  align = 'left',
  className = '',
  style,
  ...props
}) => {
  return (
    <>
      <th className={`ui-table-head ui-table-head--${align} ${className}`} style={style} {...props}>
        {children}
      </th>

      <style>{`
        .ui-table-head {
          padding: 0.85rem 1rem;
          font-size: var(--font-size-xs, 0.75rem);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary, #70625B);
          background-color: var(--color-bg-primary, #FFF1E6);
          border-bottom: 1px solid var(--color-border, #EADED6);
          white-space: nowrap;
          box-sizing: border-box;
        }

        .dark-theme .ui-table-head {
          background-color: #14110F;
          border-bottom-color: var(--color-border, #332D29);
          color: #A1A1AA;
        }

        .ui-table-head--left { text-align: left; }
        .ui-table-head--center { text-align: center; }
        .ui-table-head--right { text-align: right; }
      `}</style>
    </>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  align = 'left',
  className = '',
  style,
  ...props
}) => {
  return (
    <>
      <td className={`ui-table-cell ui-table-cell--${align} ${className}`} style={style} {...props}>
        {children}
      </td>

      <style>{`
        .ui-table-cell {
          padding: 0.85rem 1rem;
          color: var(--color-text-primary, #2D231E);
          vertical-align: middle;
          box-sizing: border-box;
          line-height: 1.4;
        }

        .dark-theme .ui-table-cell {
          color: var(--color-text-primary, #FFF1E6);
        }

        .ui-table-cell--left { text-align: left; }
        .ui-table-cell--center { text-align: center; }
        .ui-table-cell--right { text-align: right; }
      `}</style>
    </>
  );
};
