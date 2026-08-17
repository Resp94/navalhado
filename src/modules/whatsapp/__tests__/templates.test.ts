import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEMPLATES,
  interpolateTemplate,
  validateTemplateHasLink,
  SAMPLE_MOCK_VARIABLES,
  TEMPLATE_CONFIGS,
} from '../templates';

describe('WhatsApp Templates Module', () => {
  it('should contain default templates for all 5 events', () => {
    expect(DEFAULT_TEMPLATES.confirmation).toContain('{cliente}');
    expect(DEFAULT_TEMPLATES.confirmation).toContain('{link}');
    expect(DEFAULT_TEMPLATES.reschedule).toContain('{link}');
    expect(DEFAULT_TEMPLATES.cancellation).toContain('{link}');
    expect(DEFAULT_TEMPLATES.reminder).toContain('{link}');
    expect(DEFAULT_TEMPLATES.first_contact).toContain('{link}');
  });

  it('should correctly interpolate variables in a template', () => {
    const template = 'Olá, {cliente}! Seu horário na {barbearia} é dia {data} às {horario}. Link: {link}';
    const result = interpolateTemplate(template, {
      cliente: 'João',
      barbearia: 'Navalhado',
      data: '20/08/2026',
      horario: '10:00',
      link: 'https://exemplo.com/cliente/123',
    });

    expect(result).toBe('Olá, João! Seu horário na Navalhado é dia 20/08/2026 às 10:00. Link: https://exemplo.com/cliente/123');
  });

  it('should interpolate using sample mock variables properly', () => {
    const rendered = interpolateTemplate(DEFAULT_TEMPLATES.confirmation, SAMPLE_MOCK_VARIABLES);
    expect(rendered).toContain('Lucas Silva');
    expect(rendered).toContain('Navalhado Club');
    expect(rendered).toContain('Corte Degradê & Barba');
    expect(rendered).toContain('Carlos Barbeiro');
    expect(rendered).toContain('18/08/2026 às 14:30');
    expect(rendered).toContain('https://dev.navalhado.com.br/cliente/demo-acesso');
  });

  it('should validate presence of {link} tag', () => {
    expect(validateTemplateHasLink('Confira seu agendamento em {link}')).toBe(true);
    expect(validateTemplateHasLink('Confira seu agendamento em {LINK}')).toBe(true);
    expect(validateTemplateHasLink('Olá cliente, seu agendamento está marcado!')).toBe(false);
    expect(validateTemplateHasLink('')).toBe(false);
  });

  it('should define exactly 5 template configurations with valid columns', () => {
    expect(TEMPLATE_CONFIGS).toHaveLength(5);
    const keys = TEMPLATE_CONFIGS.map((c) => c.key);
    expect(keys).toEqual(['confirmation', 'reschedule', 'cancellation', 'reminder', 'first_contact']);
  });

  it('should preserve unknown tags by default for exact parity with Edge Function', () => {
    const template = 'Olá {cliente}! Serviço: {servico_personalizado}, link: {link}';
    const result = interpolateTemplate(template, {
      cliente: 'Marcos',
      link: 'https://exemplo.com',
    });
    expect(result).toBe('Olá Marcos! Serviço: {servico_personalizado}, link: https://exemplo.com');
  });
});
