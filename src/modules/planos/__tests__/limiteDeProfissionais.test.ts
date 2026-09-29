import { describe, expect, it } from 'vitest';
import { ehErroDeLimiteDeProfissionais, mensagemDeLimiteDeProfissionais } from '../limiteDeProfissionais';

describe('limiteDeProfissionais (spec 052, ticket 02)', () => {
  describe('ehErroDeLimiteDeProfissionais', () => {
    it('reconhece o erro do gatilho pela mensagem', () => {
      expect(ehErroDeLimiteDeProfissionais({ code: '53400', message: 'PROFESSIONAL_LIMIT_REACHED' })).toBe(true);
      expect(ehErroDeLimiteDeProfissionais({ message: 'PROFESSIONAL_LIMIT_REACHED' })).toBe(true);
      expect(ehErroDeLimiteDeProfissionais(new Error('PROFESSIONAL_LIMIT_REACHED'))).toBe(true);
    });

    it('sem mensagem, reconhece pelo código do banco', () => {
      expect(ehErroDeLimiteDeProfissionais({ code: '53400' })).toBe(true);
    });

    it('o código 53400 sozinho não vale quando a mensagem é de outra coisa', () => {
      expect(ehErroDeLimiteDeProfissionais({ code: '53400', message: 'too many columns' })).toBe(false);
    });

    it('não confunde outros erros com o limite do plano', () => {
      expect(ehErroDeLimiteDeProfissionais({ code: '23505', message: 'duplicate key value' })).toBe(false);
      expect(ehErroDeLimiteDeProfissionais({ code: '42501', message: 'permission denied' })).toBe(false);
      expect(ehErroDeLimiteDeProfissionais(new Error('falha de rede'))).toBe(false);
    });

    it('aceita valores que não são erro sem quebrar', () => {
      expect(ehErroDeLimiteDeProfissionais(null)).toBe(false);
      expect(ehErroDeLimiteDeProfissionais(undefined)).toBe(false);
      expect(ehErroDeLimiteDeProfissionais('PROFESSIONAL_LIMIT_REACHED')).toBe(false);
    });
  });

  describe('mensagemDeLimiteDeProfissionais', () => {
    it('cita o limite e o nome do plano e convida a subir de plano', () => {
      const mensagem = mensagemDeLimiteDeProfissionais({ name: 'Máquina', max_professionals: 5 });

      expect(mensagem).toContain('5 profissionais');
      expect(mensagem).toContain('plano Máquina');
      expect(mensagem).toMatch(/plano maior/i);
    });

    it('usa o singular quando o limite é 1', () => {
      const mensagem = mensagemDeLimiteDeProfissionais({ name: 'Tesoura', max_professionals: 1 });

      expect(mensagem).toContain('1 profissional ');
      expect(mensagem).not.toContain('1 profissionais');
    });

    it('no maior plano do catálogo, manda falar com o suporte em vez de subir de plano', () => {
      const mensagem = mensagemDeLimiteDeProfissionais({ name: 'Bancada', max_professionals: 10 }, true);

      expect(mensagem).toContain('10 profissionais do plano Bancada');
      expect(mensagem).toMatch(/suporte/i);
      expect(mensagem).not.toMatch(/plano maior/i);
    });

    it('sem o plano carregado, dá a mesma orientação sem citar números', () => {
      const mensagem = mensagemDeLimiteDeProfissionais(null);

      expect(mensagem).toMatch(/limite de profissionais do seu plano/i);
      expect(mensagem).toMatch(/plano maior/i);
    });
  });
});
