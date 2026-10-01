import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanoDoTenant } from '../types';

const { mockObterPlanoDoTenant, mockUsePlanos } = vi.hoisted(() => ({
  mockObterPlanoDoTenant: vi.fn(),
  mockUsePlanos: vi.fn(),
}));

vi.mock('../repositorio', () => ({
  planosRepository: { obterPlanoDoTenant: (...args: unknown[]) => mockObterPlanoDoTenant(...args) },
}));

vi.mock('../usePlanos', () => ({ usePlanos: () => mockUsePlanos() }));

import { usePlanoDoTenant } from '../usePlanoDoTenant';

// Spec 052, ticket 11 (revisão): com a descida de plano agendada a cota mostra o plano menor, cujo limite o banco já aplica,
// e o hook diz isso à tela: a mensagem de limite manda desfazer a descida, em vez de subir de plano.

const TESOURA: PlanoDoTenant = { id: 'p1', name: 'Tesoura', price: 59.9, max_professionals: 1 };

describe('usePlanoDoTenant', () => {
  beforeEach(() => {
    mockObterPlanoDoTenant.mockReset();
    mockUsePlanos.mockReset();
    mockUsePlanos.mockReturnValue({ ehOMaiorPlano: (maximo: number) => maximo >= 10 });
  });

  it('lê o plano da barbearia e diz que não é o maior plano nem uma descida agendada', async () => {
    mockObterPlanoDoTenant.mockResolvedValue(TESOURA);

    const { result } = renderHook(() => usePlanoDoTenant('tenant-a'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockObterPlanoDoTenant).toHaveBeenCalledWith('tenant-a');
    expect(result.current.plano).toEqual(TESOURA);
    expect(result.current.ehMaiorPlano).toBe(false);
    expect(result.current.descidaAgendada).toBe(false);
  });

  it('com a descida agendada, o plano da cota é o plano menor e o hook marca a descida', async () => {
    mockObterPlanoDoTenant.mockResolvedValue({ ...TESOURA, descidaAgendada: true });

    const { result } = renderHook(() => usePlanoDoTenant('tenant-a'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.plano?.name).toBe('Tesoura');
    expect(result.current.descidaAgendada).toBe(true);
  });

  it('sem assinatura não há plano nem descida agendada', async () => {
    mockObterPlanoDoTenant.mockResolvedValue(null);

    const { result } = renderHook(() => usePlanoDoTenant('tenant-a'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.plano).toBeNull();
    expect(result.current.descidaAgendada).toBe(false);
  });

  it('se a leitura falha, fica sem plano (a tela não mostra cota) e sem a marca da descida', async () => {
    mockObterPlanoDoTenant.mockRejectedValue(new Error('falhou'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => usePlanoDoTenant('tenant-a'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.plano).toBeNull();
    expect(result.current.descidaAgendada).toBe(false);
  });
});
