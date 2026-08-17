/**
 * Utilitários e regras de domínio para o módulo de Clientes
 */
import type {
  HistoricoVisitasCliente,
  ComandaHistoricoCliente,
  MetricasLTVCliente,
} from './types';
import { DEFAULT_LTV_METRICS } from './types';

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

/**
 * Calcula as métricas de LTV (Lifetime Value), ticket médio e recorrência de um cliente
 * baseado em seu histórico consolidado de comandas fechadas e agendamentos concluídos.
 * Regra de Domínio Pura (Arquitetura Hexagonal).
 */
export function calculateLTVMetrics(
  _clienteId: string,
  appointments: HistoricoVisitasCliente[] = [],
  comandas: ComandaHistoricoCliente[] = []
): MetricasLTVCliente {
  const closedComandas = comandas.filter((c) => c.status === 'closed');
  const completedAppointments = appointments.filter((a) => a.status === 'completed');

  if (closedComandas.length === 0 && completedAppointments.length === 0) {
    return { ...DEFAULT_LTV_METRICS };
  }

  let totalSpend = 0;
  if (closedComandas.length > 0) {
    totalSpend = closedComandas.reduce((acc, c) => acc + c.total_final, 0);
  } else {
    totalSpend = completedAppointments.reduce((acc, a) => acc + a.service_price, 0);
  }

  const totalVisits = Math.max(closedComandas.length, completedAppointments.length);
  const averageTicket = totalVisits > 0 ? totalSpend / totalVisits : 0;

  const dates: number[] = [
    ...closedComandas.map((c) => new Date(c.closed_at || c.created_at).getTime()),
    ...completedAppointments.map((a) => new Date(a.start_time).getTime()),
  ]
    .filter((d) => !isNaN(d))
    .sort((a, b) => a - b);

  const uniqueDates = Array.from(new Set(dates.map((d) => new Date(d).toDateString())))
    .map((ds) => new Date(ds).getTime())
    .sort((a, b) => a - b);

  let averageDaysBetweenVisits = 0;
  if (uniqueDates.length > 1) {
    const totalDiffDays = (uniqueDates[uniqueDates.length - 1] - uniqueDates[0]) / (1000 * 60 * 60 * 24);
    averageDaysBetweenVisits = Math.round(totalDiffDays / (uniqueDates.length - 1));
  }

  const lastVisitDate = uniqueDates.length > 0 ? new Date(uniqueDates[uniqueDates.length - 1]).toISOString() : null;

  return {
    totalSpend,
    averageTicket,
    totalVisits,
    averageDaysBetweenVisits,
    lastVisitDate,
  };
}
