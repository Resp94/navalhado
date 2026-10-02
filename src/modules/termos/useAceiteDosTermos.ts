import { useCallback, useEffect, useState } from 'react';
import { useAcaoDoGerente } from '../assinatura/useAcaoDoGerente';
import { MENSAGEM_ACEITAR_FALHOU } from './errors';
import { termosRepository } from './repositorio';
import { VERSAO_ATUAL_DOS_TERMOS } from './textos';
import type { SituacaoDoAceite } from './types';

const OPCOES_DO_ACEITE = { rotulo: 'Erro ao registrar o aceite dos termos', mensagemPadrao: MENSAGEM_ACEITAR_FALHOU };

// Devolve `true` quando grava: `executar` devolve nulo quando a ação falha, e o sucesso não pode depender de o repositório devolver
// (ou não) algum valor.
const gravarAceite = async () => {
  await termosRepository.aceitar(VERSAO_ATUAL_DOS_TERMOS);
  return true;
};

/**
 * Aceite dos Termos de Uso de quem está logado, para o porteiro do Gerente (spec 052, ticket 16). Lê, assim que monta, se a versão
 * atual dos termos já foi aceita: `pendente` põe a tela de aceite na frente do painel, e `aceitar` grava o aceite (versão e data,
 * pelo banco) e libera o painel sem recarregar a página.
 *
 * Se a leitura falha, a situação é `indisponivel` e o painel abre: o aceite é uma regra do front (o banco só o guarda), e travar
 * todo mundo por uma falha de rede, ou por uma migration que ainda não chegou a um ambiente, seria pior. Enquanto está
 * `indisponivel`, o hook lê de novo quando a aba volta a ficar visível (como o `useEstadoDeAcesso`), para quem deixou a aba aberta
 * durante a falha não ficar sem a tela até recarregar; sem temporizador, para a tela não aparecer por cima do que o Gerente está
 * fazendo. Se gravar o aceite falha, a situação segue `pendente` e `erro` traz a mensagem para a tela.
 */
export function useAceiteDosTermos() {
  const [situacao, setSituacao] = useState<SituacaoDoAceite>('carregando');
  const [leitura, setLeitura] = useState(0);

  useEffect(() => {
    let cancelado = false;

    termosRepository
      .jaAceitou(VERSAO_ATUAL_DOS_TERMOS)
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
  }, [leitura]);

  useEffect(() => {
    if (situacao !== 'indisponivel') return;

    const aoVoltarParaAAba = () => {
      if (document.visibilityState === 'visible') setLeitura((n) => n + 1);
    };
    document.addEventListener('visibilitychange', aoVoltarParaAAba);
    return () => document.removeEventListener('visibilitychange', aoVoltarParaAAba);
  }, [situacao]);

  const { executar, emAndamento, erro } = useAcaoDoGerente(gravarAceite, OPCOES_DO_ACEITE);

  const aceitar = useCallback(async () => {
    // A ação devolve nulo quando falha (o motivo fica em `erro`) e `true` quando o aceite foi gravado.
    if ((await executar()) === true) setSituacao('aceito');
  }, [executar]);

  return { situacao, aceitar, aceitando: emAndamento, erro };
}
