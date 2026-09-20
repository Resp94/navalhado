import { useCallback, useState } from 'react';
import { useToast } from '../Toast';
import { AgendaOperationError } from '../../modules/agenda/AgendaRepository';
import { useAgenda } from '../../modules/agenda/useAgenda';
import type { Appointment } from '../../pages/gerente/Agenda';

/**
 * Por que este Agendamento ainda não pode ser marcado como "não compareceu", ou null se pode.
 * É só feedback antecipado: o banco decide (estado de origem, horário e papel).
 */
export const motivoRecusaNaoCompareceu = (
  appointment: Pick<Appointment, 'status' | 'start_time'>,
  now: number = Date.now()
): string | null => {
  if (!['pending', 'confirmed'].includes(appointment.status)) {
    return 'Somente atendimentos pendentes ou confirmados podem ser marcados como não compareceu.';
  }
  if (new Date(appointment.start_time).getTime() > now) {
    return 'O atendimento ainda não começou.';
  }
  return null;
};

export type ResultadoNaoCompareceu = 'marcado' | 'recusado' | 'erro';

/**
 * Marca "não compareceu" pelo AgendaRepository e avisa o usuário. `recusado` é uma recusa de
 * regra: o estado mudou (ou o horário ainda não chegou) desde que a agenda foi carregada, e a tela
 * deve recarregar.
 */
export const useMarcarNaoCompareceu = (tenantId: string) => {
  const agendaRepo = useAgenda();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const marcar = useCallback(
    async (appointment: Pick<Appointment, 'id' | 'status' | 'start_time'>): Promise<ResultadoNaoCompareceu> => {
      const recusa = motivoRecusaNaoCompareceu(appointment);
      if (recusa) {
        addToast(recusa, 'warning');
        return 'recusado';
      }
      if (!tenantId) return 'erro';

      setSaving(true);
      try {
        await agendaRepo.marcarFalta(tenantId, appointment.id);
        addToast('Atendimento marcado como não compareceu.', 'success');
        return 'marcado';
      } catch (err: unknown) {
        console.error('Erro ao marcar atendimento como não compareceu:', err);
        if (err instanceof AgendaOperationError && err.kind === 'regra') {
          addToast(err.message, 'warning');
          return 'recusado';
        }
        addToast(
          err instanceof Error && err.message ? err.message : 'Erro ao marcar atendimento como não compareceu.',
          'error'
        );
        return 'erro';
      } finally {
        setSaving(false);
      }
    },
    [agendaRepo, addToast, tenantId]
  );

  return { marcar, saving };
};
