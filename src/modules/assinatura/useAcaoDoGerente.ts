import { useCallback, useState } from 'react';

interface OpcoesDaAcao {
  /** O começo da linha do log quando a ação falha ("Erro ao cancelar a assinatura"). */
  rotulo: string;
  /** O que o Gerente lê quando a função de cobrança não devolveu uma mensagem própria. */
  mensagemPadrao: string;
}

/**
 * Uma ação do Gerente que fala com a função de cobrança (trocar o cartão, trocar de plano, desfazer a descida, cancelar a
 * assinatura). `executar` liga `emAndamento` e devolve o resultado da ação; se a função recusou, devolve nulo e o motivo fica em
 * `erro`, pronto para mostrar ao Gerente (a mensagem da função, ou a padrão quando o que falhou não é um erro de verdade). A
 * próxima execução esquece o erro anterior; `limparErro` o esquece sem executar (o Gerente fechou a pergunta).
 *
 * `acao` precisa ter identidade estável (uma função do módulo, não uma criada a cada render): as telas usam `executar` em
 * manipuladores e dependências de efeitos.
 */
export function useAcaoDoGerente<Argumentos extends unknown[], Resultado>(
  acao: (...argumentos: Argumentos) => Promise<Resultado>,
  { rotulo, mensagemPadrao }: OpcoesDaAcao,
) {
  const [emAndamento, setEmAndamento] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const executar = useCallback(
    async (...argumentos: Argumentos): Promise<Resultado | null> => {
      setEmAndamento(true);
      setErro(null);
      try {
        return await acao(...argumentos);
      } catch (err) {
        console.error(`${rotulo}:`, err instanceof Error ? err.message : 'erro');
        setErro(err instanceof Error ? err.message : mensagemPadrao);
        return null;
      } finally {
        setEmAndamento(false);
      }
    },
    [acao, rotulo, mensagemPadrao],
  );

  const limparErro = useCallback(() => setErro(null), []);

  return { executar, emAndamento, erro, limparErro };
}
