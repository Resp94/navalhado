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
    <>
      <div className={`ui-percentage-bar ${className}`} style={style}>
        <div className="ui-percentage-bar__header">
          <span className="ui-percentage-bar__label">{label}</span>
          <span className="ui-percentage-bar__value">
            {value}
            {trailing !== undefined && trailing !== null && <> · {trailing}</>}
          </span>
        </div>
        <div className="ui-percentage-bar__track">
          {fillPercent !== null && (
            <div className="ui-percentage-bar__fill" style={{ width: `${fillPercent}%` }} />
          )}
        </div>
      </div>

      <style>{`
        .ui-percentage-bar {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .ui-percentage-bar__header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 0.75rem;
          font-size: var(--font-size-xs, 0.75rem);
        }

        .ui-percentage-bar__label {
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
        }

        .ui-percentage-bar__value {
          color: var(--color-text-secondary, #70625B);
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          white-space: nowrap;
        }

        .ui-percentage-bar__track {
          width: 100%;
          height: 8px;
          background: transparent;
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-full, 9999px);
          overflow: hidden;
        }

        .ui-percentage-bar__fill {
          height: 100%;
          background: var(--color-brand-primary, #D96C00);
          border-radius: var(--radius-full, 9999px);
          transform-origin: left;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </>
  );
};
