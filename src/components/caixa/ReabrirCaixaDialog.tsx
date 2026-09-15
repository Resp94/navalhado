import React, { useState } from 'react';
import { ConfirmDialog } from '../ui/feedback/ConfirmDialog';
import { Textarea } from '../ui/forms/Textarea';
import { CaixaRepository, CaixaValidationError } from '../../modules/caixa/CaixaRepository';
import type { CashSession } from '../../modules/caixa/types';

export interface ReabrirCaixaDialogProps {
  isOpen: boolean;
  repository: CaixaRepository;
  tenantId: string;
  session: CashSession | null;
  onReaberta: (session: CashSession) => void;
  onFechar: () => void;
}

/**
 * Diálogo de reabertura de sessão de caixa: único ponto na interface que chama
 * a RPC `reopen_cash_session` (ver `CaixaRepository.reopenSession`), até então
 * sem nenhuma tela que a acionasse. Necessário para o estorno de Baixa pela
 * gaveta, de vale ou de Quitação de Comissão com a sessão do movimento
 * fechada, que orienta "reabra o turno antes de estornar" mas não tinha como
 * o gestor fazer isso (bug encontrado na validação da spec 036).
 */
export const ReabrirCaixaDialog: React.FC<ReabrirCaixaDialogProps> = ({
  isOpen,
  repository,
  tenantId,
  session,
  onReaberta,
  onFechar,
}) => {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (saving) return;
    setMotivo('');
    setError(null);
    onFechar();
  };

  const handleConfirm = async () => {
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      const reaberta = await repository.reopenSession({
        session_id: session.id,
        tenant_id: tenantId,
        reason: motivo,
      });
      setMotivo('');
      onReaberta(reaberta);
    } catch (err) {
      if (err instanceof CaixaValidationError) {
        setError(err.message);
      } else {
        setError((err as Error)?.message || 'Não foi possível reabrir esta sessão de caixa.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title="Reabrir turno"
      variant="warning"
      confirmText="Reabrir turno"
      loading={saving}
      description={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <p>
            O turno volta ao status aberto, os valores de fechamento e conferência são apagados e
            precisarão ser refeitos. Use para estornar uma Baixa pela gaveta, um vale ou uma
            Quitação de Comissão lançados neste turno.
          </p>
          <Textarea
            label="Motivo da reabertura"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Ex: Reabrir para estornar Baixa lançada por engano"
            rows={3}
            disabled={saving}
            autoFocus
          />
          {error && (
            <p role="alert" style={{ color: 'var(--color-error, #B3261E)', margin: 0 }}>
              {error}
            </p>
          )}
        </div>
      }
    />
  );
};
