import React from 'react';
import { assinaturaRepository } from '../../modules/assinatura/repositorio';
import { mensagemDoAviso } from '../../modules/assinatura/mensagensDeAcesso';
import type { EstadoDeAcesso } from '../../modules/assinatura/types';

/** Faixa no topo do painel do Gerente enquanto a barbearia está liberada com aviso. */
export const FaixaDeAviso: React.FC<{ estado: EstadoDeAcesso }> = ({ estado }) => (
  <div
    role="status"
    className="w-full rounded-md border border-warning bg-warning-bg px-4 py-3 text-sm text-text-primary"
  >
    {mensagemDoAviso(estado, assinaturaRepository.diasRestantes(estado))}
  </div>
);
