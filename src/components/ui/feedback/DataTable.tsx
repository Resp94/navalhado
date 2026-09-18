import React from 'react';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <div className="w-full rounded-lg bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-sm)] overflow-hidden box-border font-base">
      <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <table className={`w-full border-collapse text-left text-sm ${className}`} style={style} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
};

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <thead className={className} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <tbody className={`[&_tr:hover]:bg-text-primary/2 ${className}`} {...props}>
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
    <tr
      className={`transition-colors duration-100 ease-in border-b border-border last:border-b-0 ${className}`}
      style={style}
      {...props}
    >
      {children}
    </tr>
  );
};

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

const ALIGN_CLASSES: Record<NonNullable<TableHeadProps['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  align = 'left',
  className = '',
  style,
  ...props
}) => {
  return (
    <th
      className={`px-4 py-[0.85rem] text-xs font-bold uppercase tracking-wide text-text-secondary bg-bg-primary border-b border-border whitespace-nowrap box-border ${ALIGN_CLASSES[align]} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </th>
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
    <td
      className={`px-4 py-[0.85rem] text-text-primary align-middle box-border leading-normal ${ALIGN_CLASSES[align]} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </td>
  );
};
