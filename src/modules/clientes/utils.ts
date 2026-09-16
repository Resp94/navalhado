/**
 * Utilitários e regras de domínio para o módulo de Clientes
 */
import type {
  HistoricoVisitasCliente,
  ComandaHistoricoCliente,
  MetricasLTVCliente,
} from './types';
import { DEFAULT_LTV_METRICS } from './types';
import { dateInZone } from '../../lib/timezone';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * Normaliza o número de telefone e gera o link direto do WhatsApp (wa.me)
 * Trata números com ou sem DDI 55, caracteres especiais e espaços, evitando duplicação de DDI.
 */
export function formatWhatsAppUrl(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // Se já começar com 55 e tiver 12 ou 13 dígitos (DDI + DDD + número), não duplica
  const normalizedPhone = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${normalizedPhone}${query}`;
}

function businessDay(isoString: string, timeZone: string): string | null {
  const instant = new Date(isoString);
  return isNaN(instant.getTime()) ? null : dateInZone(instant, timeZone);
}

/**
 * Calcula as métricas de LTV (Lifetime Value), ticket médio e recorrência de um cliente.
 *
 * Visita (mesma definição dos Relatórios, spec 038): dia de negócio, no fuso do tenant,
 * com ao menos um Agendamento `completed` (dia de `start_time`) ou uma Comanda `fechada`
 * (dia de `closed_at`). Os dois fatos no mesmo dia são uma Visita só.
 *
 * Total gasto: valor das Comandas fechadas sem gorjeta (a gorjeta é do profissional).
 * Agendamento concluído sem Comanda fechada vinculada entra pelo preço do serviço.
 * Regra de Domínio Pura (Arquitetura Hexagonal).
 */
export function calculateLTVMetrics(
  _clienteId: string,
  appointments: HistoricoVisitasCliente[] = [],
  comandas: ComandaHistoricoCliente[] = [],
  timeZone: string = DEFAULT_TIMEZONE
): MetricasLTVCliente {
  const closedComandas = comandas.filter((c) => c.status === 'fechada');
  const completedAppointments = appointments.filter((a) => a.status === 'completed');

  const appointmentsWithClosedComanda = new Set(
    closedComandas.map((c) => c.appointment_id).filter((id): id is string => Boolean(id))
  );

  const totalSpend =
    closedComandas.reduce((acc, c) => acc + (c.total_final - c.tip_amount), 0) +
    completedAppointments
      .filter((a) => !appointmentsWithClosedComanda.has(a.id))
      .reduce((acc, a) => acc + a.service_price, 0);

  const visitDays = Array.from(
    new Set(
      [
        ...closedComandas.map((c) => businessDay(c.closed_at || c.created_at, timeZone)),
        ...completedAppointments.map((a) => businessDay(a.start_time, timeZone)),
      ].filter((day): day is string => day !== null)
    )
  ).sort();

  if (visitDays.length === 0) {
    return { ...DEFAULT_LTV_METRICS };
  }

  const totalVisits = visitDays.length;
  const averageTicket = totalSpend / totalVisits;

  let averageDaysBetweenVisits = 0;
  if (visitDays.length > 1) {
    const dayMs = 1000 * 60 * 60 * 24;
    const totalDiffDays =
      (Date.parse(visitDays[visitDays.length - 1]) - Date.parse(visitDays[0])) / dayMs;
    averageDaysBetweenVisits = Math.round(totalDiffDays / (visitDays.length - 1));
  }

  const lastVisitDate = visitDays[visitDays.length - 1];

  return {
    totalSpend,
    averageTicket,
    totalVisits,
    averageDaysBetweenVisits,
    lastVisitDate,
  };
}
