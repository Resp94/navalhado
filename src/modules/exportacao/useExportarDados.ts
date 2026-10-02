import { useCallback, useEffect, useRef, useState } from 'react';
import { baixarCsv } from '../relatorios/csv';
import { ExportacaoError } from './ExportacaoRepository';
import { exportacaoRepository } from './repositorio';

// O navegador pergunta uma vez se o site pode baixar vários arquivos; sem uma pausa curta entre eles, os downloads seguintes
// costumam ser barrados em silêncio.
const PAUSA_ENTRE_DOWNLOADS_MS = 300;
const MENSAGEM_PADRAO = 'Não foi possível exportar os dados. Tente de novo.';

/**
 * Exportação de Dados (spec 052, ticket 14): lê os clientes, os agendamentos e as comandas da barbearia com a sessão do Gerente e
 * baixa os três CSV. `exportando` fica ligado até o último download sair e `concluido` liga depois dele (o navegador pode barrar o
 * 2º e o 3º arquivo sem avisar a página, então a tela precisa dizer quais eram); se a leitura falha, nada é baixado e `erro` traz a
 * mensagem para o Gerente (a do módulo, quando ela é do módulo, ou a padrão: o texto de uma falha do banco não é para ele). Quem
 * sai da tela no meio da exportação a cancela: as leituras param e nada é baixado depois.
 * `fuso` é o da barbearia, para o dia e a hora do arquivo; por padrão, Brasília.
 */
export function useExportarDados(tenantId: string, fuso = 'America/Sao_Paulo', pausaEntreDownloadsMs = PAUSA_ENTRE_DOWNLOADS_MS) {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const emAndamento = useRef<AbortController | null>(null);

  useEffect(() => () => emAndamento.current?.abort(), []);

  const exportar = useCallback(async () => {
    const controle = new AbortController();
    emAndamento.current = controle;
    setExportando(true);
    setErro(null);
    setConcluido(false);
    try {
      const arquivos = await exportacaoRepository.gerarArquivos(tenantId, fuso, { sinal: controle.signal });
      for (const [indice, arquivo] of arquivos.entries()) {
        if (indice > 0) await new Promise((resolve) => setTimeout(resolve, pausaEntreDownloadsMs));
        if (controle.signal.aborted) return;
        baixarCsv(arquivo.nome, arquivo.conteudo);
      }
      setConcluido(true);
    } catch (err) {
      if (controle.signal.aborted) return;
      console.error('Erro ao exportar os dados:', err);
      setErro(err instanceof ExportacaoError ? err.message : MENSAGEM_PADRAO);
    } finally {
      if (!controle.signal.aborted) setExportando(false);
    }
  }, [tenantId, fuso, pausaEntreDownloadsMs]);

  return { exportar, exportando, erro, concluido };
}
