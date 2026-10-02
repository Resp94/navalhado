import { useCallback, useEffect, useState } from 'react';
import { useAcaoDoGerente } from '../assinatura/useAcaoDoGerente';
import { MENSAGEM_ACEITAR_FALHOU } from './errors';
import { termosRepository } from './repositorio';
import { VERSAO_ATUAL_DOS_TERMOS } from './textos';
import type { SituacaoDoAceite } from './types';

const OPCOES_DO_ACEITE = { rotulo: 'Erro ao registrar o aceite dos termos', mensagemPadrao: MENSAGEM_ACEITAR_FALHOU };

/**
 * Aceite dos Termos de Uso de quem está logado, para o porteiro do Gerente (spec 052, ticket 16). Lê, assim que monta, se a versão
 * atual dos termos já foi aceita: `pendente` põe a tela de aceite na frente do painel, e `aceitar` grava o aceite (versão e data,
 * pelo banco) e libera o painel sem recarregar a página.
 *
 * Se a leitura falha, a situação é `indisponivel` e o painel abre: o aceite é uma regra do front (o banco só o guarda), e travar
 * todo mundo por uma falha de rede, ou por uma migration que ainda não chegou a um ambiente, seria pior. O Gerente vê a tela de
 * aceite no próximo acesso. Se gravar o aceite falha, a situação segue `pendente` e `erro` traz a mensagem para a tela.
 */
export function useAceiteDosTermos(versao: string = VERSAO_ATUAL_DOS_TERMOS) {
  const [situacao, setSituacao] = useState<SituacaoDoAceite>('carregando');

  useEffect(() => {
    let cancelado = false;

    termosRepository
      .jaAceitou(versao)
      .then((aceitou) => {
        if (!cancelado) setSituacao(aceitou ? 'aceito' : 'pendente');
      })
      .catch((err) => {
        console.error('Erro ao ler o aceite dos termos:', err);
        if (!cancelado) setSituacao('indisponivel');
      });

    return () => {
      cancelado = true;
    };
  }, [versao]);

  const gravarAceite = useCallback(() => termosRepository.aceitar(versao), [versao]);
  const { executar, emAndamento, erro } = useAcaoDoGerente(gravarAceite, OPCOES_DO_ACEITE);

  const aceitar = useCallback(async () => {
    // A ação devolve nulo quando falha (o motivo fica em `erro`) e `undefined` quando o aceite foi gravado.
    const gravou = (await executar()) !== null;
    if (gravou) setSituacao('aceito');
  }, [executar]);

  return { situacao, aceitar, aceitando: emAndamento, erro };
}
