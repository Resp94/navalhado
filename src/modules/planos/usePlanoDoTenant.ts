import { useEffect, useState } from 'react';
import { planosRepository } from './repositorio';
import { usePlanos } from './usePlanos';
import type { PlanoDoTenant, PlanosStatus } from './types';

/**
 * Plano da barbearia logada, para mostrar a cota de profissionais. Enquanto carrega,
 * ou se a leitura falhar, `plano` fica nulo e a tela não mostra cota: o limite de
 * verdade é o do banco, que recusa o excedente de qualquer jeito. `ehMaiorPlano` diz
 * se o plano é o maior do catálogo, para a mensagem de limite não mandar subir de plano.
 * `descidaAgendada`: o limite é o do plano menor da descida de plano agendada (o plano atual é maior),
 * e a saída é desfazer a descida, não subir de plano.
 */
export function usePlanoDoTenant(tenantId: string) {
  const [plano, setPlano] = useState<PlanoDoTenant | null>(null);
  const [status, setStatus] = useState<PlanosStatus>('loading');
  const { ehOMaiorPlano } = usePlanos();

  useEffect(() => {
    if (!tenantId) return;
    let cancelado = false;

    planosRepository
      .obterPlanoDoTenant(tenantId)
      .then((encontrado) => {
        if (cancelado) return;
        setPlano(encontrado);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Erro ao carregar o plano da barbearia:', err);
        if (!cancelado) setStatus('error');
      });

    return () => { cancelado = true; };
  }, [tenantId]);

  return {
    plano,
    status,
    ehMaiorPlano: plano !== null && ehOMaiorPlano(plano.max_professionals),
    descidaAgendada: plano?.descidaAgendada === true,
  };
}
