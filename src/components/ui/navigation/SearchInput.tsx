import React, { forwardRef, useId } from 'react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  inputSize?: 'sm' | 'md' | 'lg';
}

const WRAPPER_SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'min-h-9',
  md: 'min-h-[42px]',
  lg: 'min-h-12',
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = 'Buscar...',
      inputSize = 'md',
      id,
      className = '',
      style,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const searchId = id || generatedId;

    const handleClear = () => {
      onChange('');
      if (onClear) onClear();
    };

    return (
      <div
        className={`relative flex items-center w-full rounded-md bg-bg-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-[box-shadow,background-color] duration-150 ease-in box-border px-3 focus-within:shadow-[0_0_0_1.5px_var(--color-brand-primary)] [&:focus-within_.search-icon]:text-brand-primary ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${WRAPPER_SIZE_CLASSES[inputSize]} ${className}`}
        style={style}
      >
        <span className="search-icon flex items-center justify-center text-text-secondary mr-2 shrink-0 pointer-events-none transition-colors duration-150 ease-in" aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>

        <input
          ref={ref}
          id={searchId}
          type="search"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 w-full border-none outline-none bg-transparent text-text-primary font-base text-sm py-2 box-border placeholder:text-text-secondary placeholder:opacity-65 [&::-webkit-search-decoration]:hidden [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden"
          {...props}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full border-none bg-text-primary/8 text-text-secondary cursor-pointer p-0 ml-[0.4rem] shrink-0 transition-[background-color,color] duration-150 ease-in hover:bg-text-primary hover:text-white"
            title="Limpar busca"
            aria-label="Limpar busca"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
