import React from 'react';
import { assinaturaRepository } from '../../modules/assinatura/repositorio';
import { mensagemDoAviso } from '../../modules/assinatura/mensagensDeAcesso';
import type { EstadoDeAcesso } from '../../modules/assinatura/types';

interface FaixaDeAvisoProps {
  estado: EstadoDeAcesso;
  /** Fuso da barbearia, para a data do bloqueio. Por padrão, Brasília. */
  timezone?: string;
}

/** Faixa no topo do painel do Gerente enquanto a barbearia está liberada com aviso. */
export const FaixaDeAviso: React.FC<FaixaDeAvisoProps> = ({ estado, timezone }) => (
  <div
    role="status"
    className="w-full rounded-md border border-warning bg-warning-bg px-4 py-3 text-sm text-text-primary"
  >
    {mensagemDoAviso(estado, assinaturaRepository.diasRestantes(estado), timezone)}
  </div>
);
