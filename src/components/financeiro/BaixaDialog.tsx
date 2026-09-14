import React, { useState } from 'react';
import { Input } from '../ui/forms/Input';
import { Select } from '../ui/forms/Select';
import { Button } from '../ui/forms/Button';
import { Drawer } from '../ui/feedback/Drawer';
import {
  ContasPagarRepository,
  ContasPagarValidationError,
} from '../../modules/contas-pagar/ContasPagarRepository';
import type { Baixa, FormaPagamentoBaixa } from '../../modules/contas-pagar/types';

const OPCOES_FORMA: { value: FormaPagamentoBaixa; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'automatic_debit', label: 'Débito automático' },
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'debit_card', label: 'Cartão de débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'other', label: 'Outra' },
];

export interface BaixaDialogProps {
  isOpen: boolean;
  repository: ContasPagarRepository;
  tenantId: string;
  payableId: string;
  saldoRestante: number;
  onSalvar: (baixa: Baixa) => void;
  onCancelar: () => void;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Diálogo de Baixa (ticket 07/036): registra pagamento fora do caixa. A
 * origem gaveta ainda não está disponível (chega no ticket 15/036), então
 * não há seletor de origem aqui — todo lançamento é `fora_do_caixa`.
 */
export const BaixaDialog: React.FC<BaixaDialogProps> = ({
  isOpen,
  repository,
  tenantId,
  payableId,
  saldoRestante,
  onSalvar,
  onCancelar,
}) => {
  const [principal, setPrincipal] = useState(String(saldoRestante.toFixed(2)).replace('.', ','));
  const [interestAmount, setInterestAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<FormaPagamentoBaixa>('pix');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const baixa = await repository.darBaixa(tenantId, payableId, {
        principal: Number(principal.replace(',', '.')),
        interestAmount: interestAmount ? Number(interestAmount.replace(',', '.')) : 0,
        discountAmount: discountAmount ? Number(discountAmount.replace(',', '.')) : 0,
        paymentDate,
        paymentMethod,
        source: 'fora_do_caixa',
      });
      onSalvar(baixa);
    } catch (err) {
      if (err instanceof ContasPagarValidationError) {
        setError(err.message);
      } else {
        setError('Não foi possível dar Baixa nesta conta.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onCancelar} title="Dar Baixa">
      <form className="baixa-dialog-form" onSubmit={handleSubmit}>
        <p className="baixa-dialog-saldo">Saldo restante: {formatarMoeda(saldoRestante)}</p>

        <Input
          label="Principal"
          type="text"
          inputMode="decimal"
          value={principal}
          onChange={(event) => setPrincipal(event.target.value)}
          placeholder="0,00"
          disabled={saving}
          autoFocus
        />

        <Input
          label="Juros e multa (opcional)"
          type="text"
          inputMode="decimal"
          value={interestAmount}
          onChange={(event) => setInterestAmount(event.target.value)}
          placeholder="0,00"
          disabled={saving}
        />

        <Input
          label="Desconto (opcional)"
          type="text"
          inputMode="decimal"
          value={discountAmount}
          onChange={(event) => setDiscountAmount(event.target.value)}
          placeholder="0,00"
          disabled={saving}
        />

        <Input
          label="Data do pagamento"
          type="date"
          value={paymentDate}
          onChange={(event) => setPaymentDate(event.target.value)}
          disabled={saving}
        />

        <Select
          label="Forma de pagamento"
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value as FormaPagamentoBaixa)}
          options={OPCOES_FORMA}
          disabled={saving}
        />

        {error && (
          <div className="baixa-dialog-error" role="alert">
            {error}
          </div>
        )}

        <div className="baixa-dialog-actions">
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Confirmar Baixa
          </Button>
        </div>
      </form>

      <style>{`
        .baixa-dialog-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .baixa-dialog-saldo {
          margin: 0;
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
        }

        .dark-theme .baixa-dialog-saldo {
          color: var(--color-text-primary, #FFF1E6);
        }

        .baixa-dialog-error {
          background-color: var(--color-brand-lightest, #FFF1E6);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-md, 8px);
          padding: 0.85rem;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-primary, #2D231E);
        }

        .dark-theme .baixa-dialog-error {
          background-color: rgba(217, 108, 0, 0.15);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #FFF1E6);
          color: var(--color-text-primary, #FFF1E6);
        }

        .baixa-dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }
      `}</style>
    </Drawer>
  );
};
