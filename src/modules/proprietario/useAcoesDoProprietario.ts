import { useAcaoDoGerente } from '../assinatura/useAcaoDoGerente';
import { proprietarioRepository } from './repositorio';

/** O que o Proprietário pede para uma barbearia (os dias são AAAA-MM-DD, no fuso dela). */
export type PedidoDoProprietario =
  | { tipo: 'estenderTeste'; ate: string }
  | { tipo: 'darCortesia'; ate: string | null }
  | { tipo: 'encerrarCortesia' }
  | { tipo: 'desbloquear'; ate: string; motivo: string }
  | { tipo: 'bloquear'; motivo: string };

async function executarPedido(tenantId: string, pedido: PedidoDoProprietario): Promise<true> {
  switch (pedido.tipo) {
    case 'estenderTeste':
      await proprietarioRepository.estenderTeste(tenantId, pedido.ate);
      break;
    case 'darCortesia':
      await proprietarioRepository.darCortesia(tenantId, pedido.ate);
      break;
    case 'encerrarCortesia':
      await proprietarioRepository.encerrarCortesia(tenantId);
      break;
    case 'desbloquear':
      await proprietarioRepository.desbloquear(tenantId, pedido.ate, pedido.motivo);
      break;
    case 'bloquear':
      await proprietarioRepository.bloquear(tenantId, pedido.motivo);
      break;
  }
  return true;
}

/**
 * Uma ação do Proprietário sobre uma barbearia. `executar` devolve `true` quando o banco aceitou; se recusou, devolve nulo e o
 * motivo fica em `erro`, pronto para mostrar. A próxima execução esquece o erro anterior; `limparErro` o esquece sem executar.
 */
export function useAcoesDoProprietario() {
  return useAcaoDoGerente(executarPedido, {
    rotulo: 'Erro numa ação do Proprietário',
    mensagemPadrao: 'Não foi possível concluir. Tente de novo.',
  });
}
