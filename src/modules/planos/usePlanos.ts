import { useEffect, useState } from 'react';
import { PlanosRepository } from './PlanosRepository';
import { SupabasePlanosAdapter } from './adapters/SupabasePlanosAdapter';
import type { Plano } from './types';

export type PlanosStatus = 'loading' | 'ready' | 'error';

const repository = new PlanosRepository(new SupabasePlanosAdapter());

/** Lê o catálogo uma vez por montagem. Sem realtime: o catálogo muda por migration. */
export function usePlanos() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [status, setStatus] = useState<PlanosStatus>('loading');

  useEffect(() => {
    let cancelado = false;

    repository
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

  const planoPadraoId = repository.planoPadrao(planos)?.id ?? null;

  return { planos, status, planoPadraoId };
}
