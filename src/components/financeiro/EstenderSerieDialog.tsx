import React, { useState } from 'react';
import { Input } from '../ui/forms/Input';
import { Button } from '../ui/forms/Button';
import { Drawer } from '../ui/feedback/Drawer';
import {
  ContasPagarRepository,
  ContasPagarValidationError,
} from '../../modules/contas-pagar/ContasPagarRepository';
import type { ContaPagar, OcorrenciaPreviaExtensaoSerie } from '../../modules/contas-pagar/types';

export interface EstenderSerieDialogProps {
  isOpen: boolean;
  repository: ContasPagarRepository;
  tenantId: string;
  seriesId: string;
  onEstendida: (criadas: ContaPagar[]) => void;
  onFechar: () => void;
}

function formatarMoedaPrevia(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataPrevia(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Diálogo de extensão da Recorrência (ticket 14/036): gera de 1 a 60
 * ocorrências novas a partir da maior posição já existente, pelo mesmo
 * calendário ancorado na Série. A prévia usa o mesmo cálculo do servidor,
 * nunca replicado aqui.
 */
export const EstenderSerieDialog: React.FC<EstenderSerieDialogProps> = ({
  isOpen,
  repository,
  tenantId,
  seriesId,
  onEstendida,
  onFechar,
}) => {
  const [occurrences, setOccurrences] = useState('3');
  const [previa, setPrevia] = useState<OcorrenciaPreviaExtensaoSerie[] | null>(null);
  const [previaCarregando, setPreviaCarregando] = useState(false);
  const [previaErro, setPreviaErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerPrevia = async () => {
    setPreviaErro(null);
    setPreviaCarregando(true);
    try {
      const resultado = await repository.visualizarPreviaExtensaoSerie(
        tenantId,
        seriesId,
        Number(occurrences)
      );
      setPrevia(resultado);
    } catch (err) {
      setPrevia(null);
      if (err instanceof ContasPagarValidationError) {
        setPreviaErro(err.message);
      } else {
        setPreviaErro('Não foi possível calcular a prévia.');
      }
    } finally {
      setPreviaCarregando(false);
    }
  };

  const handleConfirm = async () => {
    setError(null);
    setSaving(true);
    try {
      const criadas = await repository.estenderRecorrencia(tenantId, seriesId, Number(occurrences));
      onEstendida(criadas);
      setOccurrences('3');
      setPrevia(null);
    } catch (err) {
      if (err instanceof ContasPagarValidationError) {
        setError(err.message);
      } else {
        setError('Não foi possível estender esta Série.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setOccurrences('3');
    setPrevia(null);
    setPreviaErro(null);
    setError(null);
    onFechar();
  };

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="Estender Recorrência">
      <div className="conta-pagar-form">
        <p>
          Gera novas ocorrências a partir da última posição existente, com o mesmo valor,
          categoria, fornecedor e descrição da última ocorrência não cancelada.
        </p>

        <Input
          label="Quantidade de novas ocorrências"
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          value={occurrences}
          onChange={(event) => {
            setOccurrences(event.target.value);
            setPrevia(null);
          }}
          disabled={saving}
          autoFocus
        />

        <Button type="button" variant="secondary" size="sm" loading={previaCarregando} onClick={handleVerPrevia}>
          Ver prévia das ocorrências
        </Button>

        {previaErro && (
          <div className="conta-pagar-form-error" role="alert">
            {previaErro}
          </div>
        )}

        {previa && previa.length > 0 && (
          <ul className="conta-pagar-form-previa" aria-label="Prévia da extensão">
            {previa.map((ocorrencia) => (
              <li key={ocorrencia.seriesPosition}>
                <span>{ocorrencia.seriesPosition}ª ocorrência</span>
                <span>{formatarDataPrevia(ocorrencia.dueDate)}</span>
                <span>{formatarMoedaPrevia(ocorrencia.amount)}</span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="conta-pagar-form-error" role="alert">
            {error}
          </div>
        )}

        <div className="conta-pagar-form-actions">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" loading={saving} onClick={handleConfirm}>
            Confirmar extensão
          </Button>
        </div>
      </div>

      <style>{`
        .conta-pagar-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .conta-pagar-form-previa {
          list-style: none;
          margin: 0;
          padding: 0;
          max-height: 220px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .conta-pagar-form-previa li {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-primary, #2D231E);
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-sm, 6px);
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #2D231E);
        }

        .dark-theme .conta-pagar-form-previa li {
          color: var(--color-text-primary, #FFF1E6);
          box-shadow: 0 0 0 0.8px var(--color-text-primary, #FFF1E6);
        }

        .conta-pagar-form-error {
          background-color: var(--color-brand-lightest, #FFF1E6);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-md, 8px);
          padding: 0.85rem;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-primary, #2D231E);
        }

        .dark-theme .conta-pagar-form-error {
          background-color: rgba(217, 108, 0, 0.15);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #FFF1E6);
          color: var(--color-text-primary, #FFF1E6);
        }

        .conta-pagar-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }
      `}</style>
    </Drawer>
  );
};
