import React, { useState } from 'react';
import { ConfirmDialog } from '../ui/feedback/ConfirmDialog';
import { Textarea } from '../ui/forms/Textarea';
import {
  ContasPagarRepository,
  ContasPagarValidationError,
} from '../../modules/contas-pagar/ContasPagarRepository';
import type { ContaPagar } from '../../modules/contas-pagar/types';

export interface CancelarContaDialogProps {
  isOpen: boolean;
  repository: ContasPagarRepository;
  tenantId: string;
  payableId: string;
  onCancelado: (conta: ContaPagar) => void;
  onFechar: () => void;
}

/**
 * Diálogo de cancelamento (ticket 08/036): terminal, só aceito sem Baixa
 * ativa. Uma conta cancelada por engano é lançada de novo, não reativada.
 */
export const CancelarContaDialog: React.FC<CancelarContaDialogProps> = ({
  isOpen,
  repository,
  tenantId,
  payableId,
  onCancelado,
  onFechar,
}) => {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setSaving(true);
    try {
      const conta = await repository.cancelarConta(tenantId, payableId, motivo);
      onCancelado(conta);
      setMotivo('');
    } catch (err) {
      if (err instanceof ContasPagarValidationError) {
        setError(err.message);
      } else {
        setError('Não foi possível cancelar esta conta.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setMotivo('');
    setError(null);
    onFechar();
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title="Cancelar conta a pagar"
      variant="danger"
      confirmText="Cancelar conta"
      loading={saving}
      description={
        <div>
          <p>
            A conta sai das listas e dos totais, sem desaparecer da auditoria. É terminal: uma conta
            cancelada por engano é lançada de novo, não reativada.
          </p>
          <Textarea
            label="Motivo do cancelamento"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Ex: Conta lançada em duplicidade"
            rows={3}
            disabled={saving}
            autoFocus
          />
          {error && (
            <p role="alert" style={{ color: 'var(--color-error, #B3261E)', marginTop: '0.5rem' }}>
              {error}
            </p>
          )}
        </div>
      }
    />
  );
};
