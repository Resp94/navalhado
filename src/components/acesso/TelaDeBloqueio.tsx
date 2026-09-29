import React from 'react';
import { Button } from '../ui';
import { explicacaoDoBloqueio, tituloDoBloqueio } from '../../modules/assinatura/mensagensDeAcesso';
import type { MotivoDeAcesso, PerfilNoBloqueio } from '../../modules/assinatura/types';

interface TelaDeBloqueioProps {
  motivo: MotivoDeAcesso;
  perfil: PerfilNoBloqueio;
  tenantName: string;
  onLogout: () => void;
}

/**
 * Único conteúdo do painel de uma barbearia bloqueada por assinatura. O Gerente vê o
 * lugar do "Pagar" (ativo no ticket 05); o Barbeiro só recebe a explicação.
 */
export const TelaDeBloqueio: React.FC<TelaDeBloqueioProps> = ({ motivo, perfil, tenantName, onLogout }) => (
  <>
    <div className="noise-overlay" />
    <main className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-lg border border-border bg-bg-secondary p-8 flex flex-col gap-4 text-center shadow-md">
        <p className="text-sm text-text-secondary">{tenantName}</p>
        <h1 className="text-2xl font-semibold">{tituloDoBloqueio(motivo)}</h1>
        <p className="text-text-secondary">{explicacaoDoBloqueio(motivo, perfil)}</p>

        {perfil === 'gerente' && (
          <div className="flex flex-col gap-2">
            <Button fullWidth disabled>
              Pagar
            </Button>
            <p className="text-xs text-text-secondary">O pagamento estará disponível em breve.</p>
          </div>
        )}

        <Button variant="ghost" fullWidth onClick={onLogout}>
          Sair da conta
        </Button>
      </section>
    </main>
  </>
);
