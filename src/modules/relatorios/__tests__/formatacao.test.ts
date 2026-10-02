import { describe, expect, it } from 'vitest';
import { formatOrigemLabel, formatRegistrationOriginLabel } from '../formatacao';

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
