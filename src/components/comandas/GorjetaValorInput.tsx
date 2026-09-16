import { HugeiconsIcon } from '@hugeicons/react';
import { Coins01Icon } from '@hugeicons/core-free-icons';

interface GorjetaProfessionalOption {
  id: string;
  name: string;
}

interface GorjetaValorInputProps {
  value: number;
  onChange: (value: number) => void;
  /**
   * Profissionais distintos presentes nos itens da Comanda (ticket 04 da spec 034).
   * Com um único profissional a atribuição é resolvida sozinha por quem chama este
   * componente; o seletor só aparece aqui quando há mais de um, e apenas quando há
   * valor de gorjeta a atribuir.
   */
  professionalOptions?: GorjetaProfessionalOption[];
  selectedProfessionalId?: string | null;
  onProfessionalChange?: (professionalId: string) => void;
}

/**
 * Campo de valor de gorjeta do checkout de Comanda.
 *
 * Extraído do ComandaCheckoutModal (ticket 01 da spec 034) para que a atribuição de
 * profissional (ticket 04) pudesse ser acrescentada aqui sem editar o modal inteiro.
 * Não conhece o restante do estado do checkout: apenas recebe o valor atual e a lista
 * de profissionais candidatos, e notifica as alterações.
 */
export function GorjetaValorInput({
  value,
  onChange,
  professionalOptions = [],
  selectedProfessionalId,
  onProfessionalChange,
}: GorjetaValorInputProps) {
  const showProfessionalPicker = value > 0 && professionalOptions.length > 1;

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
      {showProfessionalPicker && (
        <select
          className="comanda-input-num"
          aria-label="Profissional que recebe a gorjeta"
          value={selectedProfessionalId || ''}
          onChange={(e) => onProfessionalChange?.(e.target.value)}
        >
          <option value="" disabled>
            Gorjeta para quem?
          </option>
          {professionalOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
