import React from 'react';
import { Button } from '../ui';
import { BotaoAssinar } from './BotaoAssinar';
import { explicacaoDoBloqueio, tituloDoBloqueio } from '../../modules/assinatura/mensagensDeAcesso';
import type { MotivoDeAcesso, PerfilNoBloqueio } from '../../modules/assinatura/types';

interface TelaDeBloqueioProps {
  motivo: MotivoDeAcesso;
  perfil: PerfilNoBloqueio;
  tenantName: string;
  onLogout: () => void;
  /** O Gerente acabou de voltar da página do Mercado Pago: o pagamento ainda está sendo confirmado. */
  aguardandoConfirmacao?: boolean;
  /** Relê o estado de acesso, para quem não quer esperar a confirmação. */
  onAtualizar?: () => void;
  /** Como abrir o link do Mercado Pago. Por padrão, navega na mesma aba. */
  abrirLink?: (url: string) => void;
}

/**
 * Único conteúdo do painel de uma barbearia bloqueada por assinatura. O Gerente paga pelo
 * "Pagar" (abre a página do Mercado Pago); o Barbeiro só recebe a explicação.
 */
export const TelaDeBloqueio: React.FC<TelaDeBloqueioProps> = ({
  motivo,
  perfil,
  tenantName,
  onLogout,
  aguardandoConfirmacao = false,
  onAtualizar,
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

        {perfil === 'gerente' && <BotaoAssinar rotulo="Pagar" fullWidth abrirLink={abrirLink} />}

        <Button variant="ghost" fullWidth onClick={onLogout}>
          Sair da conta
        </Button>
      </section>
    </main>
  </>
);
