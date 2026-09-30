import React, { useState } from 'react';
import { Button } from '../ui';
import { FormularioDeCartao } from '../cartao/FormularioDeCartao';
import { useTrocarCartao } from '../../modules/assinatura/useTrocarCartao';
import type { CartaoRepository } from '../../modules/cartao/CartaoRepository';
import type { CartaoTokenizado } from '../../modules/cartao/types';

interface TrocarCartaoProps {
  /** Há uma cobrança recusada esperando: o Mercado Pago vai tentá-la de novo no cartão novo. */
  cobrancaPendente?: boolean;
  /** A barbearia já está bloqueada por essa cobrança: o aviso diz que o acesso volta quando ela for aprovada. */
  acessoBloqueado?: boolean;
  /** O botão é a ação principal da tela (tela de bloqueio): cor cheia e largura total. */
  destaque?: boolean;
  /** Chamado depois de o cartão ser trocado (a tela relê a assinatura e mostra o cartão novo). */
  onTrocado?: () => void;
  repositorio?: CartaoRepository;
}

function avisoDaTroca(cobrancaPendente: boolean, acessoBloqueado: boolean): string {
  if (!cobrancaPendente) return 'Cartão trocado. A próxima cobrança sai no cartão novo.';
  // O Mercado Pago é quem tenta a cobrança de novo (não há como forçar), então o prazo não é nosso.
  const situacao = acessoBloqueado ? 'o acesso' : 'a assinatura';
  return `Cartão trocado. O Mercado Pago vai tentar a cobrança pendente de novo no cartão novo, por conta própria, e isso pode levar alguns dias. Quando ela for aprovada, ${situacao} volta ao normal.`;
}

/**
 * Trocar o cartão da assinatura (spec 052, ticket 09). Começa como um botão; ao abrir, o Gerente
 * digita o cartão nos campos seguros do Mercado Pago e só o token segue para a função de cobrança.
 * A troca não cobra nada. Depois dela o aviso fica na tela até o Gerente fechá-lo, e o botão volta
 * para uma nova troca.
 */
export const TrocarCartao: React.FC<TrocarCartaoProps> = ({
  cobrancaPendente = false,
  acessoBloqueado = false,
  destaque = false,
  onTrocado,
  repositorio,
}) => {
  const { trocar, trocando, erro, limparErro } = useTrocarCartao();
  const [aberto, setAberto] = useState(false);
  const [trocado, setTrocado] = useState(false);

  const enviar = async ({ token, final }: CartaoTokenizado) => {
    const cartaoNovo = await trocar(token, final);
    if (!cartaoNovo) return;
    setTrocado(true);
    onTrocado?.();
  };

  const fechar = () => {
    setAberto(false);
    setTrocado(false);
    limparErro();
  };

  if (!aberto) {
    return (
      <div>
        <Button variant={destaque ? 'primary' : 'outline'} fullWidth={destaque} onClick={() => setAberto(true)}>
          Trocar cartão
        </Button>
      </div>
    );
  }

  if (trocado) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-md border border-border p-4">
        <p className="m-0 text-sm">{avisoDaTroca(cobrancaPendente, acessoBloqueado)}</p>
        <div>
          <Button variant="outline" size="sm" onClick={fechar}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FormularioDeCartao
      rotuloDoBotao="Trocar cartão"
      onToken={enviar}
      onCancelar={fechar}
      enviando={trocando}
      erro={erro}
      repositorio={repositorio}
    />
  );
};
