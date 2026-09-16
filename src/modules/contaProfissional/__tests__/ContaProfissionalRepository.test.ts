import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContaProfissionalRepository, ContaProfissionalValidationError } from '../ContaProfissionalRepository';
import type { IContaProfissionalAdapter } from '../types';

describe('ContaProfissionalRepository', () => {
  const mockAdapter: IContaProfissionalAdapter = {
    registrarVale: vi.fn(),
    estornarVale: vi.fn(),
    listarLancamentos: vi.fn(),
  };

  const repository = new ContaProfissionalRepository(mockAdapter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lança um vale válido em dinheiro repassando o contrato ao adaptador', async () => {
    vi.mocked(mockAdapter.registrarVale).mockResolvedValueOnce({
      success: true,
      entry_id: 'entry-1',
      professional_id: 'prof-1',
      amount: 30,
      cash_movement_id: 'mov-1',
      cash_session_id: 'sess-1',
    });

    const result = await repository.registerAdvance({
      professional_id: 'prof-1',
      amount: 30,
      reason: 'Adiantamento para o corte de cabelo',
      payment_method: 'cash',
      tenant_id: 'tenant-1',
      cash_session_id: 'sess-1',
    });

    expect(result.entry_id).toBe('entry-1');
    expect(mockAdapter.registrarVale).toHaveBeenCalledWith({
      professional_id: 'prof-1',
      amount: 30,
      reason: 'Adiantamento para o corte de cabelo',
      payment_method: 'cash',
      tenant_id: 'tenant-1',
      cash_session_id: 'sess-1',
    });
  });

  it('rejeita vale sem profissional informado', async () => {
    await expect(
      repository.registerAdvance({
        professional_id: '',
        amount: 30,
        reason: 'Adiantamento combinado',
        payment_method: 'pix',
      })
    ).rejects.toThrow(ContaProfissionalValidationError);
    expect(mockAdapter.registrarVale).not.toHaveBeenCalled();
  });

  it('rejeita vale com valor zero ou negativo', async () => {
    await expect(
      repository.registerAdvance({
        professional_id: 'prof-1',
        amount: 0,
        reason: 'Adiantamento combinado',
        payment_method: 'pix',
      })
    ).rejects.toThrow(ContaProfissionalValidationError);
    expect(mockAdapter.registrarVale).not.toHaveBeenCalled();
  });

  it('rejeita vale com motivo curto demais', async () => {
    await expect(
      repository.registerAdvance({
        professional_id: 'prof-1',
        amount: 30,
        reason: 'oi',
        payment_method: 'pix',
      })
    ).rejects.toThrow(ContaProfissionalValidationError);
    expect(mockAdapter.registrarVale).not.toHaveBeenCalled();
  });

  it('rejeita vale em dinheiro sem sessão de caixa informada', async () => {
    await expect(
      repository.registerAdvance({
        professional_id: 'prof-1',
        amount: 30,
        reason: 'Adiantamento combinado',
        payment_method: 'cash',
      })
    ).rejects.toThrow(ContaProfissionalValidationError);
    expect(mockAdapter.registrarVale).not.toHaveBeenCalled();
  });

  it('rejeita sessão de caixa informada para vale que não seja em dinheiro', async () => {
    await expect(
      repository.registerAdvance({
        professional_id: 'prof-1',
        amount: 30,
        reason: 'Adiantamento combinado',
        payment_method: 'pix',
        cash_session_id: 'sess-1',
      })
    ).rejects.toThrow(ContaProfissionalValidationError);
    expect(mockAdapter.registrarVale).not.toHaveBeenCalled();
  });

  it('estorna um vale válido repassando o contrato ao adaptador', async () => {
    vi.mocked(mockAdapter.estornarVale).mockResolvedValueOnce({ reversed: true });

    await repository.reverseAdvance({
      entry_id: 'entry-1',
      tenant_id: 'tenant-1',
      reason: 'Lançado por engano',
    });

    expect(mockAdapter.estornarVale).toHaveBeenCalledWith({
      entry_id: 'entry-1',
      tenant_id: 'tenant-1',
      reason: 'Lançado por engano',
    });
  });

  it('rejeita estorno sem id do vale', async () => {
    await expect(
      repository.reverseAdvance({ entry_id: '', reason: 'Lançado por engano' })
    ).rejects.toThrow(ContaProfissionalValidationError);
    expect(mockAdapter.estornarVale).not.toHaveBeenCalled();
  });

  it('rejeita estorno com justificativa curta demais', async () => {
    await expect(
      repository.reverseAdvance({ entry_id: 'entry-1', reason: 'oi' })
    ).rejects.toThrow(ContaProfissionalValidationError);
    expect(mockAdapter.estornarVale).not.toHaveBeenCalled();
  });

  it('lista os lançamentos de um profissional repassando o contrato ao adaptador', async () => {
    vi.mocked(mockAdapter.listarLancamentos).mockResolvedValueOnce([
      {
        id: 'entry-1',
        tenant_id: 'tenant-1',
        professional_id: 'prof-1',
        entry_type: 'vale',
        direction: 'debit',
        amount: 30,
        settled_amount: 0,
        status: 'open',
        reason: 'Adiantamento',
        comanda_id: null,
        cash_movement_id: 'mov-1',
        created_by: 'user-1',
        created_at: '2026-09-12T10:00:00Z',
        reversed_at: null,
        reversed_by: null,
        reversal_reason: null,
      },
    ]);

    const result = await repository.listEntries('prof-1', 'tenant-1');

    expect(result).toHaveLength(1);
    expect(mockAdapter.listarLancamentos).toHaveBeenCalledWith('prof-1', 'tenant-1');
  });

  it('rejeita listagem sem profissional informado', async () => {
    await expect(repository.listEntries('', 'tenant-1')).rejects.toThrow(ContaProfissionalValidationError);
    expect(mockAdapter.listarLancamentos).not.toHaveBeenCalled();
  });
});
