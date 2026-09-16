import React, { useState } from 'react';
import { ConfirmDialog } from '../ui/feedback/ConfirmDialog';
import { Textarea } from '../ui/forms/Textarea';
import {
  ContasPagarRepository,
  ContasPagarValidationError,
} from '../../modules/contas-pagar/ContasPagarRepository';
import type { Baixa } from '../../modules/contas-pagar/types';

export interface EstornoBaixaDialogProps {
  isOpen: boolean;
  repository: ContasPagarRepository;
  tenantId: string;
  settlementId: string;
  onEstornado: (baixa: Baixa) => void;
  onCancelar: () => void;
}

/** Diálogo de Estorno de Baixa (ticket 07/036): exige motivo com pelo menos cinco caracteres. */
export const EstornoBaixaDialog: React.FC<EstornoBaixaDialogProps> = ({
  isOpen,
  repository,
  tenantId,
  settlementId,
  onEstornado,
  onCancelar,
}) => {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setSaving(true);
    try {
      const baixa = await repository.estornarBaixa(tenantId, settlementId, motivo);
      onEstornado(baixa);
      setMotivo('');
    } catch (err) {
      if (err instanceof ContasPagarValidationError) {
        setError(err.message);
      } else {
        setError('Não foi possível estornar esta Baixa.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setMotivo('');
    setError(null);
    onCancelar();
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title="Estornar Baixa"
      variant="warning"
      confirmText="Estornar"
      loading={saving}
      description={
        <div>
          <p>A conta volta a ficar em aberto ou parcialmente paga. Nada é apagado.</p>
          <Textarea
            label="Motivo do estorno"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Ex: Baixa lançada por engano"
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
