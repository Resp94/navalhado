import { useMemo } from 'react';
import { AgendaRepository } from './AgendaRepository';
import { SupabaseAgendaAdapter } from './adapters/SupabaseAgendaAdapter';
import type { IAgendaAdapter } from './types';

let defaultAdapter: IAgendaAdapter | null = null;

export const useAgenda = (customAdapter?: IAgendaAdapter) => {
  return useMemo(() => {
    if (customAdapter) {
      return new AgendaRepository(customAdapter);
    }
    if (!defaultAdapter) {
      defaultAdapter = new SupabaseAgendaAdapter();
    }
    return new AgendaRepository(defaultAdapter);
  }, [customAdapter]);
};
