import { useCallback, useState } from 'react';
import { baixarCsv } from '../relatorios/csv';
import { ExportacaoError } from './ExportacaoRepository';
import { exportacaoRepository } from './repositorio';

// O navegador pergunta uma vez se o site pode baixar vários arquivos; sem uma pausa curta entre eles, os downloads seguintes
// costumam ser barrados em silêncio.
const PAUSA_ENTRE_DOWNLOADS_MS = 300;
const MENSAGEM_PADRAO = 'Não foi possível exportar os dados. Tente de novo.';

/**
 * Exportação de Dados (spec 052, ticket 14): lê os clientes, os agendamentos e as comandas da barbearia com a sessão do Gerente e
 * baixa os três CSV. `exportando` fica ligado até o último download sair; se a leitura falha, nada é baixado e `erro` traz a
 * mensagem para o Gerente (a do módulo, quando ela é do módulo, ou a padrão: o texto de uma falha do banco não é para ele).
 * `fuso` é o da barbearia, para o dia e a hora do arquivo; por padrão, Brasília.
 */
export function useExportarDados(tenantId: string, fuso = 'America/Sao_Paulo', pausaEntreDownloadsMs = PAUSA_ENTRE_DOWNLOADS_MS) {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const exportar = useCallback(async () => {
    setExportando(true);
    setErro(null);
    try {
      const arquivos = await exportacaoRepository.gerarArquivos(tenantId, fuso);
      for (const [indice, arquivo] of arquivos.entries()) {
        if (indice > 0) await new Promise((resolve) => setTimeout(resolve, pausaEntreDownloadsMs));
        baixarCsv(arquivo.nome, arquivo.conteudo);
      }
    } catch (err) {
      console.error('Erro ao exportar os dados:', err);
      setErro(err instanceof ExportacaoError ? err.message : MENSAGEM_PADRAO);
    } finally {
      setExportando(false);
    }
  }, [tenantId, fuso, pausaEntreDownloadsMs]);

  return { exportar, exportando, erro };
}
