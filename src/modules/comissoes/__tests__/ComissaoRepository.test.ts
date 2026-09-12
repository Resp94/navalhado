import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComissaoRepository, ComissaoValidationError } from '../ComissaoRepository';
import type { IComissaoAdapter } from '../types';

describe('ComissaoRepository', () => {
  const mockAdapter: IComissaoAdapter = {
    registrarQuitacao: vi.fn(),
    obterSaldoProfissional: vi.fn(),
  };

  const repository = new ComissaoRepository(mockAdapter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra uma quitação válida repassando o contrato ao adaptador', async () => {
    vi.mocked(mockAdapter.registrarQuitacao).mockResolvedValueOnce({
      success: true,
      payout_id: 'payout-1',
      amount: 50,
      professional_id: 'prof-1',
    });

    const result = await repository.registerPayout({
      professional_id: 'prof-1',
      amount: 50,
      payment_method: 'pix',
      notes: 'Quitação semanal',
      tenant_id: 'tenant-1',
    });

    expect(result.payout_id).toBe('payout-1');
    expect(mockAdapter.registrarQuitacao).toHaveBeenCalledWith({
      professional_id: 'prof-1',
      amount: 50,
      payment_method: 'pix',
      notes: 'Quitação semanal',
      tenant_id: 'tenant-1',
    });
  });

  it('rejeita quitação sem profissional informado', async () => {
    await expect(
      repository.registerPayout({
        professional_id: '',
        amount: 50,
        payment_method: 'pix',
      })
    ).rejects.toThrow(ComissaoValidationError);
    expect(mockAdapter.registrarQuitacao).not.toHaveBeenCalled();
  });

  it('rejeita quitação com valor zero ou negativo', async () => {
    await expect(
      repository.registerPayout({
        professional_id: 'prof-1',
        amount: 0,
        payment_method: 'pix',
      })
    ).rejects.toThrow(ComissaoValidationError);

    await expect(
      repository.registerPayout({
        professional_id: 'prof-1',
        amount: -10,
        payment_method: 'pix',
      })
    ).rejects.toThrow(ComissaoValidationError);

    expect(mockAdapter.registrarQuitacao).not.toHaveBeenCalled();
  });

  it('rejeita quitação sem forma de pagamento', async () => {
    await expect(
      repository.registerPayout({
        professional_id: 'prof-1',
        amount: 50,
        payment_method: '' as never,
      })
    ).rejects.toThrow(ComissaoValidationError);
    expect(mockAdapter.registrarQuitacao).not.toHaveBeenCalled();
  });

  it('rejeita quitação em dinheiro sem sessão de caixa informada', async () => {
    await expect(
      repository.registerPayout({
        professional_id: 'prof-1',
        amount: 50,
        payment_method: 'cash',
      })
    ).rejects.toThrow(ComissaoValidationError);
    expect(mockAdapter.registrarQuitacao).not.toHaveBeenCalled();
  });

  it('rejeita sessão de caixa informada para método diferente de dinheiro', async () => {
    await expect(
      repository.registerPayout({
        professional_id: 'prof-1',
        amount: 50,
        payment_method: 'pix',
        cash_session_id: 'session-1',
      })
    ).rejects.toThrow(ComissaoValidationError);
    expect(mockAdapter.registrarQuitacao).not.toHaveBeenCalled();
  });

  it('registra quitação em dinheiro repassando a sessão de caixa ao adaptador', async () => {
    vi.mocked(mockAdapter.registrarQuitacao).mockResolvedValueOnce({
      success: true,
      payout_id: 'payout-2',
      amount: 30,
      professional_id: 'prof-1',
    });

    await repository.registerPayout({
      professional_id: 'prof-1',
      amount: 30,
      payment_method: 'cash',
      cash_session_id: 'session-1',
    });

    expect(mockAdapter.registrarQuitacao).toHaveBeenCalledWith(
      expect.objectContaining({ cash_session_id: 'session-1' })
    );
  });

  it('propaga erro de domínio traduzido pelo adaptador', async () => {
    vi.mocked(mockAdapter.registrarQuitacao).mockRejectedValueOnce(
      new Error('O valor informado excede o saldo pendente de comissao.')
    );

    await expect(
      repository.registerPayout({
        professional_id: 'prof-1',
        amount: 999,
        payment_method: 'pix',
      })
    ).rejects.toThrow('O valor informado excede o saldo pendente de comissao.');
  });

  it('consulta o saldo do profissional repassando o contrato ao adaptador', async () => {
    vi.mocked(mockAdapter.obterSaldoProfissional).mockResolvedValueOnce({
      current_open_balance: 40,
      generated_commission: 100,
      paid_commission: 60,
    });

    const saldo = await repository.getProfessionalBalance({
      professional_id: 'prof-1',
      tenant_id: 'tenant-1',
    });

    expect(saldo.current_open_balance).toBe(40);
    expect(mockAdapter.obterSaldoProfissional).toHaveBeenCalledWith({
      professional_id: 'prof-1',
      tenant_id: 'tenant-1',
    });
  });

  it('rejeita consulta de saldo sem profissional informado', async () => {
    await expect(
      repository.getProfessionalBalance({ professional_id: '' })
    ).rejects.toThrow(ComissaoValidationError);
    expect(mockAdapter.obterSaldoProfissional).not.toHaveBeenCalled();
  });
});
