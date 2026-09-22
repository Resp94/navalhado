import { useCallback, useState } from 'react';
import type { AgendamentoDoDia } from '../../modules/agenda/types';

/**
 * Estado do Painel de Cancelados do Dia: o que carregou, se a leitura falhou, se o painel está
 * aberto. A Agenda do gerente e a Minha Agenda do barbeiro tinham essas três peças duplicadas,
 * cada uma com o próprio trio de `useState` e a mesma dupla de chamadas a cada sucesso ou falha
 * de leitura (spec 044, ticket 04).
 */
export const useCanceladosDoDia = () => {
  const [cancelados, setCancelados] = useState<AgendamentoDoDia[]>([]);
  const [canceladosComErro, setCanceladosComErro] = useState(false);
  const [isCanceladosOpen, setIsCanceladosOpen] = useState(false);

  /** A leitura do dia trouxe a lista, com ou sem sucesso: sucesso substitui, falha esvazia e marca o erro. */
  const registrarCancelados = useCallback((resultado: AgendamentoDoDia[] | 'falhou') => {
    if (resultado === 'falhou') {
      setCancelados([]);
      setCanceladosComErro(true);
      return;
    }
    setCancelados(resultado);
    setCanceladosComErro(false);
  }, []);

  const abrirCancelados = useCallback(() => setIsCanceladosOpen(true), []);
  const fecharCancelados = useCallback(() => setIsCanceladosOpen(false), []);

  return {
    cancelados,
    canceladosComErro,
    isCanceladosOpen,
    registrarCancelados,
    abrirCancelados,
    fecharCancelados,
  };
};
