import { describe, expect, it } from 'vitest';
import { explicacaoDoBloqueio, mensagemDoAviso, tituloDoBloqueio } from '../mensagensDeAcesso';
import type { EstadoDeAcesso, MotivoDeAcesso } from '../types';

const aviso = (motivo: MotivoDeAcesso): EstadoDeAcesso => ({ acesso: 'aviso', motivo, dataRelevante: null });

describe('mensagens de acesso', () => {
  describe('tela de bloqueio', () => {
    it.each<[MotivoDeAcesso, string]>([
      ['trial_expired', 'Seu período de teste terminou'],
      ['payment_failed', 'O pagamento da assinatura não foi aprovado'],
      ['canceled', 'Sua assinatura foi cancelada'],
      ['courtesy_expired', 'A cortesia da sua barbearia terminou'],
      ['blocked', 'O acesso da sua barbearia está suspenso'],
    ])('o motivo %s tem o título "%s"', (motivo, titulo) => {
      expect(tituloDoBloqueio(motivo)).toBe(titulo);
    });

    it('motivo que não é de bloqueio cai no título genérico', () => {
      expect(tituloDoBloqueio('trial')).toBe('O acesso da sua barbearia está suspenso');
    });

    it.each<MotivoDeAcesso>(['trial_expired', 'courtesy_expired', 'blocked'])(
      'o Gerente com o motivo %s é convidado a assinar e é avisado de que os dados ficam guardados',
      (motivo) => {
        const texto = explicacaoDoBloqueio(motivo, 'gerente');

        expect(texto).toMatch(/assine um plano/i);
        expect(texto).toMatch(/dados da sua barbearia continuam guardados/i);
      }
    );

    it('pagamento recusado manda atualizar o cartão da assinatura que já existe, não assinar de novo', () => {
      const texto = explicacaoDoBloqueio('payment_failed', 'gerente');

      expect(texto).toMatch(/atualize o cartão/i);
      expect(texto).not.toMatch(/assine/i);
      expect(texto).toMatch(/dados da sua barbearia continuam guardados/i);
    });

    it('assinatura cancelada explica o cancelamento e convida a assinar de novo', () => {
      const texto = explicacaoDoBloqueio('canceled', 'gerente');

      expect(texto).toMatch(/foi cancelada/i);
      expect(texto).toMatch(/assine um plano de novo/i);
    });

    it.each<MotivoDeAcesso>(['trial_expired', 'payment_failed', 'canceled', 'courtesy_expired', 'blocked'])(
      'o Barbeiro com o motivo %s só recebe a explicação e a orientação de falar com o gerente',
      (motivo) => {
        const texto = explicacaoDoBloqueio(motivo, 'barbeiro');

        expect(texto).toMatch(/gerente/i);
        expect(texto).not.toMatch(/assine|cartão/i);
      }
    );
  });

  describe('faixa de aviso', () => {
    it('teste com vários dias restantes', () => {
      expect(mensagemDoAviso(aviso('trial'), 3)).toBe('Seu período de teste termina em 3 dias.');
    });

    it('teste com 1 dia restante usa o singular', () => {
      expect(mensagemDoAviso(aviso('trial'), 1)).toBe('Seu período de teste termina em 1 dia.');
    });

    it('pagamento recusado diz em quantos dias o acesso bloqueia', () => {
      expect(mensagemDoAviso(aviso('payment_failed'), 2)).toBe(
        'O pagamento da sua assinatura foi recusado. O acesso será bloqueado em 2 dias.'
      );
    });

    it('sem contagem de dias, a mensagem não inventa um número', () => {
      expect(mensagemDoAviso(aviso('trial'), null)).toBe('Seu período de teste está terminando.');
    });
  });
});
