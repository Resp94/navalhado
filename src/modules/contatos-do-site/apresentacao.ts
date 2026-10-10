import type { StatusDoContato } from './types';

export const ROTULO_DO_STATUS: Record<StatusDoContato, string> = {
  novo: 'Novo',
  lido: 'Lido',
  respondido: 'Respondido',
};

/** DD/MM/AAAA, HH:MM no horário de Brasília, o fuso da plataforma (o contato não é de nenhuma barbearia). */
export const quandoChegou = (data: Date): string =>
  data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
