import React, { useEffect, useState } from 'react';
import { Input } from '../ui/forms/Input';
import { Select } from '../ui/forms/Select';
import { Button } from '../ui/forms/Button';
import { Drawer } from '../ui/feedback/Drawer';
import { SegmentedControl } from '../ui/navigation/SegmentedControl';
import {
  ContasPagarRepository,
  ContasPagarValidationError,
} from '../../modules/contas-pagar/ContasPagarRepository';
import type { CaixaRepository } from '../../modules/caixa/CaixaRepository';
import type { Baixa, FormaPagamentoBaixa, OrigemDinheiroBaixa } from '../../modules/contas-pagar/types';

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
  /** Repositório de Caixa (ticket 15/036): detecta a sessão aberta e lê o disponível apurado. */
  caixaRepository: CaixaRepository;
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
 * Diálogo de Baixa (ticket 07/036, origem gaveta no ticket 15/036). A origem
 * gaveta só aparece quando existe uma Sessão de Caixa aberta; ao escolhê-la,
 * a forma de pagamento trava em dinheiro, a data some (o servidor define o
 * dia de negócio corrente) e o disponível apurado pelo ticket 01/036 aparece
 * para o gestor conferir antes de confirmar.
 */
export const BaixaDialog: React.FC<BaixaDialogProps> = ({
  isOpen,
  repository,
  caixaRepository,
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
  const [origem, setOrigem] = useState<OrigemDinheiroBaixa>('fora_do_caixa');
  const [sessaoAbertaId, setSessaoAbertaId] = useState<string | null>(null);
  const [disponivelGaveta, setDisponivelGaveta] = useState<number | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let ativo = true;
    setCarregandoSessao(true);
    caixaRepository
      .getActiveSession(tenantId)
      .then((sessao) => {
        if (!ativo) return;
        setSessaoAbertaId(sessao?.status === 'open' ? sessao.id : null);
      })
      .catch(() => {
        if (ativo) setSessaoAbertaId(null);
      })
      .finally(() => {
        if (ativo) setCarregandoSessao(false);
      });
    return () => {
      ativo = false;
    };
  }, [isOpen, tenantId, caixaRepository]);

  useEffect(() => {
    if (origem !== 'gaveta' || !sessaoAbertaId) {
      setDisponivelGaveta(null);
      return;
    }
    let ativo = true;
    caixaRepository
      .getExpectedDrawerAmount(sessaoAbertaId, tenantId)
      .then((resultado) => {
        if (ativo) setDisponivelGaveta(resultado.expected_amount);
      })
      .catch(() => {
        if (ativo) setDisponivelGaveta(null);
      });
    return () => {
      ativo = false;
    };
  }, [origem, sessaoAbertaId, tenantId, caixaRepository]);

  const handleTrocarOrigem = (novaOrigem: OrigemDinheiroBaixa) => {
    setOrigem(novaOrigem);
    setError(null);
    if (novaOrigem === 'gaveta') {
      setPaymentMethod('cash');
    }
  };

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
        source: origem,
        cashSessionId: origem === 'gaveta' ? sessaoAbertaId : null,
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

  const pelaGaveta = origem === 'gaveta';

  return (
    <Drawer isOpen={isOpen} onClose={onCancelar} title="Dar Baixa">
      <form className="baixa-dialog-form" onSubmit={handleSubmit}>
        <p className="baixa-dialog-saldo">Saldo restante: {formatarMoeda(saldoRestante)}</p>

        {!carregandoSessao && sessaoAbertaId && (
          <SegmentedControl
            value={origem}
            onChange={handleTrocarOrigem}
            aria-label="Origem do dinheiro"
            options={[
              { id: 'fora_do_caixa', label: 'Fora do caixa' },
              { id: 'gaveta', label: 'Pela gaveta' },
            ]}
          />
        )}

        {pelaGaveta && (
          <p className="baixa-dialog-disponivel">
            Disponível na gaveta: {disponivelGaveta != null ? formatarMoeda(disponivelGaveta) : '...'}
          </p>
        )}

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

        {!pelaGaveta && (
          <Input
            label="Data do pagamento"
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
            disabled={saving}
          />
        )}

        {pelaGaveta ? (
          <Input label="Forma de pagamento" type="text" value="Dinheiro" disabled readOnly />
        ) : (
          <Select
            label="Forma de pagamento"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as FormaPagamentoBaixa)}
            options={OPCOES_FORMA}
            disabled={saving}
          />
        )}

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

        .baixa-dialog-disponivel {
          margin: 0;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-secondary, #70625B);
        }

        .baixa-dialog-error {
          background-color: var(--color-brand-lightest, #FFF1E6);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-md, 8px);
          padding: 0.85rem;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-primary, #2D231E);
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
