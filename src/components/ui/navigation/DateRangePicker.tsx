import React, { useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar03Icon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Popover, PopoverTrigger, PopoverContent } from './Popover';

export interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  ariaLabel?: string;
  numberOfMonths?: 1 | 2;
}

const toLocalDate = (isoDate: string): Date => {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const toIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatShort = (date: Date): string => format(date, 'dd/MM');

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  from,
  to,
  onChange,
  ariaLabel = 'Selecionar período',
  numberOfMonths = 2,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected: DateRange = { from: toLocalDate(from), to: toLocalDate(to) };

  const label =
    from === to
      ? formatShort(selected.from!)
      : `${formatShort(selected.from!)} – ${formatShort(selected.to!)}`;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="inline-flex items-center gap-2 min-h-[38px] px-[0.6rem] rounded-sm bg-transparent shadow-[0_0_0_0.8px_var(--color-text-primary)] text-text-primary text-xs font-semibold box-border cursor-pointer hover:shadow-[0_0_0_1.2px_var(--color-text-primary)] data-[state=open]:shadow-[0_0_0_1.5px_var(--color-brand-primary)]"
        >
          <HugeiconsIcon icon={Calendar03Icon} size={15} />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-3" align="start">
        <DayPicker
          mode="range"
          locale={ptBR}
          numberOfMonths={numberOfMonths}
          defaultMonth={selected.from}
          selected={selected}
          onSelect={(range) => {
            if (range?.from && range?.to) {
              onChange({ from: toIsoDate(range.from), to: toIsoDate(range.to) });
              setIsOpen(false);
            } else if (range?.from) {
              onChange({ from: toIsoDate(range.from), to: toIsoDate(range.from) });
            }
          }}
          classNames={{
            months: 'flex gap-4',
            month: 'flex flex-col gap-2',
            month_caption: 'flex items-center justify-center h-8 text-sm font-bold text-text-primary',
            nav: 'flex items-center justify-between absolute inset-x-1 top-0 h-8',
            button_previous: 'inline-flex items-center justify-center w-7 h-7 rounded-sm text-text-secondary hover:bg-text-primary/6 hover:text-text-primary',
            button_next: 'inline-flex items-center justify-center w-7 h-7 rounded-sm text-text-secondary hover:bg-text-primary/6 hover:text-text-primary',
            month_grid: 'w-full border-collapse',
            weekdays: 'flex',
            weekday: 'w-9 h-8 text-[11px] font-bold text-text-secondary uppercase flex items-center justify-center',
            week: 'flex',
            day: 'w-9 h-9 text-center align-middle p-0',
            day_button: 'w-9 h-9 rounded-sm text-sm text-text-primary hover:bg-brand-lightest cursor-pointer',
            range_start: '[&>button]:bg-brand-primary-solid [&>button]:text-white [&>button]:hover:bg-brand-primary-solid rounded-l-sm',
            range_end: '[&>button]:bg-brand-primary-solid [&>button]:text-white [&>button]:hover:bg-brand-primary-solid rounded-r-sm',
            range_middle: 'bg-brand-lightest [&>button]:hover:bg-brand-lightest',
            today: '[&>button]:font-extrabold [&>button]:text-brand-primary',
            outside: '[&>button]:text-text-secondary/40',
            disabled: '[&>button]:opacity-30 [&>button]:cursor-not-allowed',
          }}
          components={{
            Chevron: ({ orientation }) => (
              <HugeiconsIcon icon={orientation === 'left' ? ArrowLeft01Icon : ArrowRight01Icon} size={16} />
            ),
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
