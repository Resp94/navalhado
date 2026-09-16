import React from 'react';

export interface PercentageBarProps {
  /** Rótulo visível acima da barra. Pode ser `''` quando o nome já aparece em outra coluna/lugar (ex.: dentro de uma célula de tabela). */
  label: string;
  value: React.ReactNode;
  /** Fração 0-1, ou `null` quando não há dado (nenhum preenchimento é desenhado). */
  share: number | null;
  /** Texto opcional anexado após `value`, separado por " · " (ex.: "3 pagamentos"). */
  trailing?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const PercentageBar: React.FC<PercentageBarProps> = ({
  label,
  value,
  share,
  trailing,
  className = '',
  style,
}) => {
  const fillPercent = share !== null ? Math.max(0, Math.min(1, share)) * 100 : null;

  return (
    <div className={`flex flex-col gap-[0.35rem] ${className}`} style={style}>
      <div className="flex justify-between items-baseline gap-3 text-xs">
        <span className="font-bold text-text-primary">{label}</span>
        <span className="text-text-secondary [font-variant-numeric:tabular-nums] font-semibold whitespace-nowrap">
          {value}
          {trailing !== undefined && trailing !== null && <> · {trailing}</>}
        </span>
      </div>
      <div className="w-full h-2 bg-transparent shadow-[0_0_0_0.5px_var(--color-text-primary)] rounded-full overflow-hidden">
        {fillPercent !== null && (
          <div
            className="h-full bg-brand-primary rounded-full origin-left transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${fillPercent}%` }}
          />
        )}
      </div>
    </div>
  );
};
