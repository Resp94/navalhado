import React from 'react';
import { Drawer } from '../ui/feedback/Drawer';
import { Badge } from '../ui/data-display/Badge';
import type { BadgeVariant } from '../ui/data-display/Badge';
import { EmptyState } from '../ui/data-display/EmptyState';
import { Button } from '../ui/forms/Button';
import { formatTimeInZone } from '../../lib/timezone';
import { maskPhone } from '../../lib/whatsapp';
import type { AgendamentoDoDia } from '../../modules/agenda/types';

export const MOTIVO_NAO_INFORMADO = 'Sem motivo informado';
export const CLIENTE_DE_BALCAO = 'Cliente Balcão';
export const TELEFONE_NAO_INFORMADO = 'Sem telefone';

/** Cancelamento anterior à autoria fica desconhecido: o painel não infere pelo texto do motivo. */
const AUTORIA: Record<'shop' | 'customer' | 'desconhecida', { rotulo: string; variante: BadgeVariant }> = {
  shop: { rotulo: 'Barbearia', variante: 'brand' },
  customer: { rotulo: 'Cliente', variante: 'info' },
  desconhecida: { rotulo: 'Desconhecido', variante: 'neutral' },
};

/**
 * O encaixe de balcão pode não ter cliente cadastrado: `customer_id` aceita nulo no banco, e o tipo
 * de leitura do Agendamento já declara isso (spec 044, ticket 03). O alias fica só pelo nome, mais
 * claro no contexto do painel.
 */
export type CanceladoDoPainel = AgendamentoDoDia;

interface PainelCanceladosDoDiaProps {
  isOpen: boolean;
  onClose: () => void;
  cancelados: CanceladoDoPainel[];
  timezone: string;
  /** A leitura falhou: não é o mesmo que um dia sem cancelamento. */
  falhouAoCarregar?: boolean;
  /** Quando informado, cada entrada oferece o atalho para chamar o cliente e tentar reocupar o horário. */
  onContatarCliente?: (cancelado: CanceladoDoPainel) => void;
}

/** Cancelados do dia, já recortados pelo banco para o usuário; o painel só apresenta o que recebe. */
export const PainelCanceladosDoDia: React.FC<PainelCanceladosDoDiaProps> = ({
  isOpen,
  onClose,
  cancelados,
  timezone,
  falhouAoCarregar = false,
  onContatarCliente,
}) => {
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
                  {cancelado.customer?.name || CLIENTE_DE_BALCAO}
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
                  <span className="min-w-0 text-right break-words flex items-center justify-end gap-1.5 flex-wrap">
                    {cancelado.professional?.name ?? 'Profissional'}
                    {cancelado.professional && !cancelado.professional.is_active && (
                      <Badge
                        variant="neutral"
                        badgeType="subtle"
                        size="xs"
                        title="Este profissional não faz mais parte da equipe"
                      >
                        Desativado
                      </Badge>
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-text-secondary">Telefone:</span>
                  <span className="min-w-0 text-right break-words">
                    {cancelado.customer?.phone?.trim()
                      ? maskPhone(cancelado.customer.phone)
                      : TELEFONE_NAO_INFORMADO}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Cancelado por:</span>
                  <Badge
                    variant={AUTORIA[cancelado.canceled_by ?? 'desconhecida'].variante}
                    badgeType="subtle"
                    size="xs"
                  >
                    {AUTORIA[cancelado.canceled_by ?? 'desconhecida'].rotulo}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-1 pt-2 border-t border-dashed border-border">
                <span className="text-xs text-text-secondary">Motivo:</span>
                <p className="m-0 text-sm text-text-primary break-words">
                  {cancelado.cancellation_reason || MOTIVO_NAO_INFORMADO}
                </p>
              </div>
              {onContatarCliente && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start [@media(pointer:coarse)]:min-h-11"
                  disabled={!cancelado.customer?.phone?.trim()}
                  title={cancelado.customer?.phone?.trim() ? undefined : 'Cliente sem telefone cadastrado'}
                  onClick={() => onContatarCliente(cancelado)}
                >
                  Chamar no WhatsApp
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
};
