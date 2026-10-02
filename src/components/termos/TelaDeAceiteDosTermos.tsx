import React from 'react';
import { Button } from '../ui';
import { BotaoExportarDados } from '../acesso/BotaoExportarDados';
import { PedidoDeAceiteDosTermos } from './PedidoDeAceiteDosTermos';
import { DESCRICAO_DA_EXPORTACAO } from '../../modules/exportacao/mensagens';
import { formatDisplayDate } from '../../modules/relatorios/formatacao';
import { VERSAO_ATUAL_DOS_TERMOS } from '../../modules/termos/textos';

interface TelaDeAceiteDosTermosProps {
  /** O aceite está sendo gravado. */
  aceitando: boolean;
  /** Por que o aceite não foi gravado, para o Gerente tentar de novo. */
  erro: string | null;
  onAceitar: () => void;
  onLogout: () => void;
  /** Barbearia e fuso dela, para o Gerente que não aceita exportar os dados. Sem a barbearia identificada a tela não oferece a exportação. */
  tenantId?: string;
  timezone?: string;
}

/**
 * Tela que o Gerente vê, antes do painel e do onboarding, quando ainda não aceitou a versão atual dos Termos de Uso e da Política
 * de Privacidade (spec 052, ticket 16). Com a barbearia bloqueada quem aparece é a tela de bloqueio, com o aceite no lugar do
 * "Pagar": o aceite condiciona entrar e contratar, e não sair. Por isso quem não aceita ainda baixa os dados da barbearia ("os dados
 * nunca ficam presos ao Navalhado") e sai da conta; cancelar a assinatura sem aceitar é direto no Mercado Pago.
 */
export const TelaDeAceiteDosTermos: React.FC<TelaDeAceiteDosTermosProps> = ({
  aceitando,
  erro,
  onAceitar,
  onLogout,
  tenantId,
  timezone,
}) => (
  <>
    <div className="noise-overlay" />
    <main className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-lg border border-border bg-bg-secondary p-8 flex flex-col gap-4 text-center shadow-md">
        <h1 className="text-2xl font-semibold">Termos de Uso e Política de Privacidade</h1>
        <p className="m-0 text-text-secondary">
          Para continuar usando o Navalhado, leia e aceite os Termos de Uso e a Política de Privacidade (versão de{' '}
          {formatDisplayDate(VERSAO_ATUAL_DOS_TERMOS)}).
        </p>

        <PedidoDeAceiteDosTermos aceitando={aceitando} erro={erro} onAceitar={onAceitar} />

        {tenantId && (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-sm text-text-secondary">Mesmo sem aceitar agora, você leva os seus dados. {DESCRICAO_DA_EXPORTACAO}</p>
            <BotaoExportarDados tenantId={tenantId} timezone={timezone} fullWidth />
          </div>
        )}

        <Button variant="ghost" fullWidth onClick={onLogout}>
          Sair da conta
        </Button>
      </section>
    </main>
  </>
);
