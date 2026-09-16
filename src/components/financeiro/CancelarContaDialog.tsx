import React, { useState } from 'react';
import { ConfirmDialog } from '../ui/feedback/ConfirmDialog';
import { Textarea } from '../ui/forms/Textarea';
import { SegmentedControl } from '../ui/navigation/SegmentedControl';
import {
  ContasPagarRepository,
  ContasPagarValidationError,
} from '../../modules/contas-pagar/ContasPagarRepository';
import type { AlcanceOperacaoSerie, ContaPagar, OcorrenciaAtingidaSerie } from '../../modules/contas-pagar/types';

export interface CancelarContaDialogProps {
  isOpen: boolean;
  repository: ContasPagarRepository;
  tenantId: string;
  payableId: string;
  /** Presente quando a conta pertence a uma Série (ticket 13/036): habilita a escolha de alcance. */
  pertenceASerie?: boolean;
  onCancelado: (conta: ContaPagar) => void;
  /** Chamado depois que o gestor fecha o resumo de um cancelamento em Série, para a tela recarregar. */
  onSerieCancelada?: () => void;
  onFechar: () => void;
}

function rotuloIgnorada(status: string): string {
  if (status === 'partially_paid') return 'parcialmente paga';
  if (status === 'paid') return 'paga';
  if (status === 'cancelled') return 'já estava cancelada';
  return status;
}

/**
 * Diálogo de cancelamento (ticket 08/036): terminal, só aceito sem Baixa
 * ativa. Uma conta cancelada por engano é lançada de novo, não reativada.
 *
 * Ticket 13/036: quando a conta pertence a uma Série, um controle segmentado
 * escolhe o alcance -- "esta e as seguintes em aberto" cancela a partir
 * dela, ignorando pagas/parcialmente pagas/já canceladas, e mostra quantas
 * foram ignoradas e por quê antes de fechar.
 */
export const CancelarContaDialog: React.FC<CancelarContaDialogProps> = ({
  isOpen,
  repository,
  tenantId,
  payableId,
  pertenceASerie = false,
  onCancelado,
  onSerieCancelada,
  onFechar,
}) => {
  const [alcance, setAlcance] = useState<AlcanceOperacaoSerie>('apenas_esta');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultadoSerie, setResultadoSerie] = useState<OcorrenciaAtingidaSerie[] | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setSaving(true);
    try {
      if (alcance === 'esta_e_seguintes') {
        const atingidas = await repository.cancelarSerie(tenantId, payableId, motivo);
        setResultadoSerie(atingidas);
        return;
      }

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
    setAlcance('apenas_esta');
    setError(null);
    onFechar();
  };

  const handleFecharResultado = () => {
    setResultadoSerie(null);
    setMotivo('');
    setAlcance('apenas_esta');
    onSerieCancelada?.();
  };

  if (resultadoSerie) {
    const ignoradas = resultadoSerie.filter((item) => item.ignored);
    const canceladas = resultadoSerie.length - ignoradas.length;
    return (
      <ConfirmDialog
        isOpen={isOpen}
        onClose={handleFecharResultado}
        onConfirm={handleFecharResultado}
        title="Cancelamento em Série concluído"
        variant="danger"
        confirmText="Concluir"
        description={
          <div>
            <p>
              {canceladas} {canceladas === 1 ? 'ocorrência cancelada' : 'ocorrências canceladas'}
              {ignoradas.length > 0 &&
                `, ${ignoradas.length} ${ignoradas.length === 1 ? 'ignorada' : 'ignoradas'}`}
              .
            </p>
            {ignoradas.length > 0 && (
              <ul
                aria-label="Ocorrências ignoradas"
                style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
              >
                {ignoradas.map((item) => (
                  <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: 'var(--font-size-sm, 0.875rem)' }}>
                    <span>{item.seriesPosition}ª ocorrência</span>
                    <span>{item.ignoreReason || `Está ${rotuloIgnorada(item.status)}.`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
      />
    );
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={alcance === 'esta_e_seguintes' ? 'Cancelar esta e as seguintes' : 'Cancelar conta a pagar'}
      variant="danger"
      confirmText={alcance === 'esta_e_seguintes' ? 'Cancelar em Série' : 'Cancelar conta'}
      loading={saving}
      description={
        <div>
          {pertenceASerie && (
            <div style={{ marginBottom: '0.85rem' }}>
              <SegmentedControl
                value={alcance}
                onChange={setAlcance}
                aria-label="Alcance do cancelamento"
                options={[
                  { id: 'apenas_esta', label: 'Apenas esta' },
                  { id: 'esta_e_seguintes', label: 'Esta e as seguintes em aberto' },
                ]}
              />
            </div>
          )}
          <p>
            {alcance === 'esta_e_seguintes'
              ? 'Cancela esta ocorrência e as seguintes que ainda estiverem em aberto, ignorando as pagas, parcialmente pagas e já canceladas. É terminal: uma ocorrência cancelada por engano é lançada de novo, não reativada.'
              : 'A conta sai das listas e dos totais, sem desaparecer da auditoria. É terminal: uma conta cancelada por engano é lançada de novo, não reativada.'}
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
