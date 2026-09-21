import React from 'react';
import { Drawer } from '../ui/feedback/Drawer';
import { EmptyState } from '../ui/data-display/EmptyState';
import { formatTimeInZone } from '../../lib/timezone';
import type { AgendamentoDoDia } from '../../modules/agenda/types';

export const MOTIVO_NAO_INFORMADO = 'Sem motivo informado';

interface PainelCanceladosDoDiaProps {
  isOpen: boolean;
  onClose: () => void;
  cancelados: AgendamentoDoDia[];
  profissionais: Array<{ id: string; name: string }>;
  timezone: string;
  /** A leitura falhou: não é o mesmo que um dia sem cancelamento. */
  falhouAoCarregar?: boolean;
}

/** Cancelados do dia, já recortados pelo banco para o usuário; o painel só apresenta o que recebe. */
export const PainelCanceladosDoDia: React.FC<PainelCanceladosDoDiaProps> = ({
  isOpen,
  onClose,
  cancelados,
  profissionais,
  timezone,
  falhouAoCarregar = false,
}) => {
  const nomeDoProfissional = (id: string) => profissionais.find((p) => p.id === id)?.name ?? 'Profissional';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Cancelados do dia"
      description={
        falhouAoCarregar
          ? undefined
          : `${cancelados.length} ${cancelados.length === 1 ? 'cancelamento' : 'cancelamentos'} no dia selecionado`
      }
    >
      {falhouAoCarregar ? (
        <EmptyState
          compact
          title="Não foi possível carregar os cancelamentos"
          description="Feche o painel e tente de novo. Se continuar, avise o gerente."
        />
      ) : cancelados.length === 0 ? (
        <EmptyState
          compact
          title="Nenhum cancelamento neste dia"
          description="Quando um atendimento for cancelado, ele aparece aqui com o motivo."
        />
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-3">
          {cancelados.map((cancelado) => (
            <li
              key={cancelado.id}
              className="border border-border rounded-md p-4 bg-bg-secondary flex flex-col gap-2 min-w-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <strong className="text-sm font-bold text-text-primary min-w-0 break-words">
                  {cancelado.customer.name}
                </strong>
                <span className="text-sm font-bold text-text-primary tabular-nums shrink-0">
                  {formatTimeInZone(cancelado.start_time, timezone)}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-text-secondary">Serviço:</span>
                  <span className="min-w-0 text-right break-words">{cancelado.service.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-text-secondary">Profissional:</span>
                  <span className="min-w-0 text-right break-words">{nomeDoProfissional(cancelado.professional_id)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 pt-2 border-t border-dashed border-border">
                <span className="text-xs text-text-secondary">Motivo:</span>
                <p className="m-0 text-sm text-text-primary break-words">
                  {cancelado.cancellation_reason || MOTIVO_NAO_INFORMADO}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
};
