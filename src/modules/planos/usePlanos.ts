import { useEffect, useState } from 'react';
import { planosRepository } from './repositorio';
import type { Plano, PlanosStatus } from './types';

/** Lê o catálogo uma vez por montagem. Sem realtime: o catálogo muda por migration. */
export function usePlanos() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [status, setStatus] = useState<PlanosStatus>('loading');

  useEffect(() => {
    let cancelado = false;

    planosRepository
      .listar()
      .then((lista) => {
        if (cancelado) return;
        setPlanos(lista);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Erro ao carregar os planos:', err);
        if (!cancelado) setStatus('error');
      });

    return () => { cancelado = true; };
  }, []);

  const planoPadraoId = planosRepository.planoPadrao(planos)?.id ?? null;
  const ehOMaiorPlano = (maxProfessionals: number) =>
    planosRepository.ehOMaiorPlano(planos, { max_professionals: maxProfessionals });

  return { planos, status, planoPadraoId, ehOMaiorPlano };
}
