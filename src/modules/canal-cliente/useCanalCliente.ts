import { useMemo } from 'react';
import { CanalClienteRepository } from './CanalClienteRepository';
import { SupabaseCanalClienteAdapter } from './adapters/SupabaseCanalClienteAdapter';
import type { ICanalClienteAdapter } from './types';

let defaultAdapter: ICanalClienteAdapter | null = null;

export const useCanalCliente = (customAdapter?: ICanalClienteAdapter) => {
  const repository = useMemo(() => {
    if (customAdapter) {
      return new CanalClienteRepository(customAdapter);
    }
    if (!defaultAdapter) {
      defaultAdapter = new SupabaseCanalClienteAdapter();
    }
    return new CanalClienteRepository(defaultAdapter);
  }, [customAdapter]);

  return repository;
};
