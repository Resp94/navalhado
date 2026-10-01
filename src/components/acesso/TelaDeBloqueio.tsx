import React from 'react';
import { Button } from '../ui';
import { BotaoAssinar } from './BotaoAssinar';
import { BotaoExportarDados } from './BotaoExportarDados';
import { CancelarAssinatura } from './CancelarAssinatura';
import { TrocarCartao } from './TrocarCartao';
import { explicacaoDoBloqueio, tituloDoBloqueio } from '../../modules/assinatura/mensagensDeAcesso';
import type { AssinaturaCancelavel, MotivoDeAcesso, PerfilNoBloqueio } from '../../modules/assinatura/types';

interface TelaDeBloqueioProps {
  motivo: MotivoDeAcesso;
  perfil: PerfilNoBloqueio;
  tenantName: string;
  /** Barbearia e fuso dela, para o Gerente exportar os dados. Sem a barbearia identificada a tela não oferece a exportação. */
  tenantId?: string;
  timezone?: string;
  onLogout: () => void;
  /** O Gerente acabou de voltar da página do Mercado Pago: o pagamento ainda está sendo confirmado. */
  aguardandoConfirmacao?: boolean;
  /** Relê o estado de acesso, para quem não quer esperar a confirmação. */
  onAtualizar?: () => void;
  /** Chamado depois de o Gerente cancelar a assinatura que ainda cobra: relê o estado de acesso (o motivo passa a ser canceled). */
  onCancelada?: () => void;
  /** Como abrir o link do Mercado Pago. Por padrão, navega na mesma aba. */
  abrirLink?: (url: string) => void;
}

// Bloqueios em que a assinatura costuma seguir viva no Mercado Pago, e cobraria no mês seguinte: pagamento recusado (em
// retentativa), estorno, contestação e bloqueio do Proprietário. O teste e a cortesia vencidos não têm assinatura paga; a cancelada
// já está cancelada.
const MOTIVOS_COM_ASSINATURA_VIVA: MotivoDeAcesso[] = ['payment_failed', 'refunded', 'charged_back', 'blocked'];

// Na tela de bloqueio o acesso já está bloqueado e não há período a esperar: a pergunta só diz que a cobrança para.
const ASSINATURA_BLOQUEADA: AssinaturaCancelavel = {
  situacao: 'blocked',
  testeAte: null,
  periodoAte: null,
  assinaturaNovaAutorizada: false,
};

/**
 * Único conteúdo do painel de uma barbearia bloqueada por assinatura. O Gerente paga pelo
 * "Pagar" (abre a página do Mercado Pago); com o pagamento recusado, troca o cartão da assinatura
 * que já existe (o "Pagar" só levaria a uma recusa: a assinatura anterior continua ativa no
 * Mercado Pago). Quando a assinatura segue viva no Mercado Pago (pagamento recusado, estorno,
 * contestação, bloqueio do Proprietário), o Gerente que não quer voltar pode cancelá-la, para não
 * ser cobrado no mês seguinte; o acesso segue bloqueado. Em qualquer bloqueio o Gerente também baixa os dados da
 * barbearia ("Exportar dados": os dados nunca ficam presos ao Navalhado). O Barbeiro só recebe a explicação.
 */
export const TelaDeBloqueio: React.FC<TelaDeBloqueioProps> = ({
  motivo,
  perfil,
  tenantName,
  tenantId,
  timezone,
  onLogout,
  aguardandoConfirmacao = false,
  onAtualizar,
  onCancelada,
  abrirLink,
}) => (
  <>
    <div className="noise-overlay" />
    <main className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-lg border border-border bg-bg-secondary p-8 flex flex-col gap-4 text-center shadow-md">
        <p className="text-sm text-text-secondary">{tenantName}</p>
        <h1 className="text-2xl font-semibold">{tituloDoBloqueio(motivo)}</h1>
        <p className="text-text-secondary">{explicacaoDoBloqueio(motivo, perfil)}</p>

        {perfil === 'gerente' && aguardandoConfirmacao && (
          <div role="status" className="flex flex-col gap-2 rounded-md border border-border p-4">
            <p className="m-0 text-sm">
              Estamos confirmando seu pagamento. Assim que o Mercado Pago avisar, o acesso da barbearia volta.
            </p>
            {onAtualizar && (
              <Button variant="outline" size="sm" onClick={onAtualizar}>
                Atualizar situação
              </Button>
            )}
          </div>
        )}

        {perfil === 'gerente' && motivo !== 'payment_failed' && <BotaoAssinar rotulo="Pagar" fullWidth abrirLink={abrirLink} />}

        {perfil === 'gerente' && motivo === 'payment_failed' && (
          <div className="text-left">
            <TrocarCartao cobrancaPendente acessoBloqueado destaque />
          </div>
        )}

        {/* Com o pagamento em confirmação a assinatura viva pode ser a que acabou de ser paga: cancelá-la jogaria o pagamento fora. */}
        {perfil === 'gerente' && !aguardandoConfirmacao && MOTIVOS_COM_ASSINATURA_VIVA.includes(motivo) && (
          <CancelarAssinatura assinatura={ASSINATURA_BLOQUEADA} onCancelada={onCancelada} />
        )}

        {perfil === 'gerente' && tenantId && <BotaoExportarDados tenantId={tenantId} timezone={timezone} fullWidth />}

        <Button variant="ghost" fullWidth onClick={onLogout}>
          Sair da conta
        </Button>
      </section>
    </main>
  </>
);
