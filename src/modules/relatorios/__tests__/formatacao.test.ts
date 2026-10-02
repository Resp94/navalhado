import { describe, expect, it } from 'vitest';
import { formatDisplayDate, formatOrigemLabel, formatRegistrationOriginLabel } from '../formatacao';

// A data de publicação dos Termos de Uso (AAAA-MM-DD) também sai por aqui (spec 052, ticket 16): sem passar por fuso horário.
describe('formatDisplayDate', () => {
  it('mostra AAAA-MM-DD como DD/MM/AAAA, sem passar por fuso', () => {
    expect(formatDisplayDate('2026-10-02')).toBe('02/10/2026');
    expect(formatDisplayDate('2027-01-01')).toBe('01/01/2027');
  });

  it('a data ausente vira o traço, em vez de "undefined"', () => {
    expect(formatDisplayDate('')).toBe('--/--/----');
  });
});

// Os rótulos de origem são um só para o Módulo de Relatórios e para a Exportação de Dados (spec 052, ticket 14): o mesmo valor do
// banco não pode ter dois nomes onde o Gerente confere os números.

describe('formatOrigemLabel (origem do Agendamento)', () => {
  it.each([
    ['manual', 'Painel'],
    ['online', 'Link público'],
    ['client_channel', 'Canal do Cliente'],
    ['whatsapp', 'WhatsApp'],
  ])('%s vira %s', (origem, rotulo) => {
    expect(formatOrigemLabel(origem)).toBe(rotulo);
  });

  it('uma origem que ainda não tem rótulo passa como está, em vez de sumir', () => {
    expect(formatOrigemLabel('totem')).toBe('totem');
  });
});

describe('formatRegistrationOriginLabel (origem do cadastro do Cliente)', () => {
  it.each([
    ['balcao', 'Balcão'],
    ['agenda', 'Agenda'],
    ['online', 'Link público'],
    ['canal_cliente', 'Canal do Cliente'],
    ['whatsapp_bot', 'WhatsApp'],
    ['importacao', 'Importação'],
  ])('%s vira %s', (origem, rotulo) => {
    expect(formatRegistrationOriginLabel(origem)).toBe(rotulo);
  });

  it('uma origem que ainda não tem rótulo passa como está, em vez de sumir', () => {
    expect(formatRegistrationOriginLabel('totem')).toBe('totem');
  });
});
