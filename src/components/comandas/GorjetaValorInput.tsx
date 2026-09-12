import { HugeiconsIcon } from '@hugeicons/react';
import { Coins01Icon } from '@hugeicons/core-free-icons';

interface GorjetaValorInputProps {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Campo de valor de gorjeta do checkout de Comanda.
 *
 * Extraído do ComandaCheckoutModal (ticket 01 da spec 034) para que a atribuição de
 * profissional (ticket 04) possa ser acrescentada aqui sem editar o modal inteiro.
 * Não conhece o restante do estado do checkout: apenas recebe o valor atual e notifica
 * a alteração.
 */
export function GorjetaValorInput({ value, onChange }: GorjetaValorInputProps) {
  return (
    <div className="comanda-form-group">
      <label className="comanda-label">
        <HugeiconsIcon icon={Coins01Icon} size={14} className="label-icon" />
        <span>Gorjeta</span>
      </label>
      <div className="comanda-input-prefix-wrapper">
        <span className="comanda-input-prefix">R$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value || ''}
          onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
          placeholder="0,00"
          className="comanda-input-num comanda-input-num--prefixed"
          aria-label="Valor da gorjeta"
        />
      </div>
    </div>
  );
}
