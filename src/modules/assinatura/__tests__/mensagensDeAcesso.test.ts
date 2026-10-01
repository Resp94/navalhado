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
      ['refunded', 'Um pagamento da assinatura foi estornado'],
      ['charged_back', 'Um pagamento da assinatura foi contestado'],
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

    it.each<[MotivoDeAcesso, RegExp]>([
      ['refunded', /foi estornado/i],
      ['charged_back', /foi contestado/i],
    ])('o motivo %s explica o que aconteceu, convida a assinar de novo e diz que os dados ficam guardados', (motivo, aconteceu) => {
      const texto = explicacaoDoBloqueio(motivo, 'gerente');

      expect(texto).toMatch(aconteceu);
      expect(texto).toMatch(/assine um plano de novo/i);
      expect(texto).toMatch(/dados da sua barbearia continuam guardados/i);
    });

    it('assinatura cancelada explica o cancelamento e convida a assinar de novo', () => {
      const texto = explicacaoDoBloqueio('canceled', 'gerente');

      expect(texto).toMatch(/foi cancelada/i);
      expect(texto).toMatch(/assine um plano de novo/i);
    });

    it.each<MotivoDeAcesso>(['trial_expired', 'payment_failed', 'canceled', 'courtesy_expired', 'refunded', 'charged_back', 'blocked'])(
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

    // A data é a do bloqueio (5 dias depois da primeira recusa), no fuso da barbearia.
    it('pagamento recusado diz até que dia atualizar o cartão para não perder o acesso', () => {
      const recusado: EstadoDeAcesso = {
        acesso: 'aviso',
        motivo: 'payment_failed',
        dataRelevante: new Date('2026-10-03T15:00:00Z'),
      };

      expect(mensagemDoAviso(recusado, 2)).toBe(
        'Pagamento recusado. Atualize o cartão até 03/10 para não ter o acesso bloqueado.'
      );
    });

    it('a data do bloqueio segue o fuso da barbearia', () => {
      // 03:30 UTC de 04/10: 00:30 do dia 4 em Brasília, 23:30 do dia 3 em Manaus.
      const recusado: EstadoDeAcesso = {
        acesso: 'aviso',
        motivo: 'payment_failed',
        dataRelevante: new Date('2026-10-04T03:30:00Z'),
      };

      expect(mensagemDoAviso(recusado, 1)).toContain('até 04/10');
      expect(mensagemDoAviso(recusado, 1, 'America/Manaus')).toContain('até 03/10');
    });

    it('pagamento recusado sem data do bloqueio não inventa uma', () => {
      expect(mensagemDoAviso(aviso('payment_failed'), null)).toBe(
        'Pagamento recusado. Atualize o cartão para não ter o acesso bloqueado.'
      );
    });

    it('sem contagem de dias, a mensagem não inventa um número', () => {
      expect(mensagemDoAviso(aviso('trial'), null)).toBe('Seu período de teste está terminando.');
    });

    // Spec 052, ticket 12: a cancelada tem acesso até o fim do período pago, com a faixa "Assinatura cancelada. Acesso até DD/MM.".
    it('cancelada diz até quando o acesso continua', () => {
      const cancelada: EstadoDeAcesso = {
        acesso: 'aviso',
        motivo: 'canceled',
        dataRelevante: new Date('2026-10-29T23:26:22Z'),
      };

      expect(mensagemDoAviso(cancelada, 28)).toBe('Assinatura cancelada. Acesso até 29/10.');
    });

    it('a data do fim do acesso da cancelada segue o fuso da barbearia', () => {
      // 03:30 UTC de 04/10: 00:30 do dia 4 em Brasília, 23:30 do dia 3 em Manaus.
      const cancelada: EstadoDeAcesso = {
        acesso: 'aviso',
        motivo: 'canceled',
        dataRelevante: new Date('2026-10-04T03:30:00Z'),
      };

      expect(mensagemDoAviso(cancelada, 1)).toBe('Assinatura cancelada. Acesso até 04/10.');
      expect(mensagemDoAviso(cancelada, 1, 'America/Manaus')).toBe('Assinatura cancelada. Acesso até 03/10.');
    });

    it('cancelada sem a data do fim do acesso não inventa uma', () => {
      expect(mensagemDoAviso(aviso('canceled'), null)).toBe('Assinatura cancelada.');
    });
  });
});
