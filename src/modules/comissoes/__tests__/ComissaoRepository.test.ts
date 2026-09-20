import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComissaoRepository, ComissaoValidationError } from '../ComissaoRepository';
import type { IComissaoAdapter } from '../types';

describe('ComissaoRepository', () => {
  const mockAdapter: IComissaoAdapter = {
    registrarQuitacao: vi.fn(),
    obterSaldoProfissional: vi.fn(),
    estornarQuitacao: vi.fn(),
    obterExtratoProfissional: vi.fn(),
    obterItensComissao: vi.fn(),
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

  describe('reversePayout', () => {
    it('estorna uma quitação repassando o contrato ao adaptador', async () => {
      vi.mocked(mockAdapter.estornarQuitacao).mockResolvedValueOnce({
        reversed: true,
        reversed_at: '2026-09-12T00:00:00.000Z',
      });

      const result = await repository.reversePayout({
        payout_id: 'payout-1',
        tenant_id: 'tenant-1',
        reason: 'Quitação registrada por engano',
      });

      expect(result.reversed).toBe(true);
      expect(mockAdapter.estornarQuitacao).toHaveBeenCalledWith({
        payout_id: 'payout-1',
        tenant_id: 'tenant-1',
        reason: 'Quitação registrada por engano',
      });
    });

    it('rejeita estorno sem id da quitação', async () => {
      await expect(
        repository.reversePayout({ payout_id: '', reason: 'Motivo valido' })
      ).rejects.toThrow(ComissaoValidationError);
      expect(mockAdapter.estornarQuitacao).not.toHaveBeenCalled();
    });

    it('rejeita estorno sem justificativa suficiente', async () => {
      await expect(
        repository.reversePayout({ payout_id: 'payout-1', reason: 'oi' })
      ).rejects.toThrow(ComissaoValidationError);
      expect(mockAdapter.estornarQuitacao).not.toHaveBeenCalled();
    });

    it('propaga erro de domínio traduzido pelo adaptador ao estornar', async () => {
      vi.mocked(mockAdapter.estornarQuitacao).mockRejectedValueOnce(
        new Error('Esta quitacao ja foi estornada.')
      );

      await expect(
        repository.reversePayout({ payout_id: 'payout-1', reason: 'Tentativa duplicada' })
      ).rejects.toThrow('Esta quitacao ja foi estornada.');
    });
  });

  describe('getProfessionalStatement', () => {
    it('consulta o extrato repassando o contrato ao adaptador', async () => {
      vi.mocked(mockAdapter.obterExtratoProfissional).mockResolvedValueOnce({
        entries: [],
        current_balance: { current_open_balance: 0, generated_commission: 0, paid_commission: 0 },
      });

      const result = await repository.getProfessionalStatement({
        professional_id: 'prof-1',
        tenant_id: 'tenant-1',
      });

      expect(result.entries).toEqual([]);
      expect(mockAdapter.obterExtratoProfissional).toHaveBeenCalledWith({
        professional_id: 'prof-1',
        tenant_id: 'tenant-1',
      });
    });

    it('rejeita consulta sem id do profissional', async () => {
      await expect(
        repository.getProfessionalStatement({ professional_id: '' })
      ).rejects.toThrow(ComissaoValidationError);
      expect(mockAdapter.obterExtratoProfissional).not.toHaveBeenCalled();
    });

    it('propaga erro de dominio traduzido pelo adaptador ao consultar o extrato', async () => {
      vi.mocked(mockAdapter.obterExtratoProfissional).mockRejectedValueOnce(
        new Error('Acesso negado para este extrato.')
      );

      await expect(
        repository.getProfessionalStatement({ professional_id: 'prof-1' })
      ).rejects.toThrow('Acesso negado para este extrato.');
    });
  });

  describe('obterItensComissaoProfissional', () => {
    const item = {
      item_id: 'item-1',
      comanda_id: 'comanda-1',
      accrued_at: '2026-09-19T15:00:00.000Z',
      customer_name: 'Pedro',
      item_type: 'servico',
      item_name: 'Corte Tradicional',
      net_amount: 50,
      commission_percentage: 40,
      commission_amount: 20,
    };

    it('repassa profissional, período e barbearia ao adaptador e devolve os itens gravados', async () => {
      vi.mocked(mockAdapter.obterItensComissao).mockResolvedValueOnce([item]);

      const result = await repository.obterItensComissaoProfissional({
        professional_id: 'prof-1',
        start_date: '2026-09-01T03:00:00.000Z',
        end_date: '2026-09-20T15:00:00.000Z',
        tenant_id: 'tenant-1',
      });

      expect(result).toEqual([item]);
      expect(mockAdapter.obterItensComissao).toHaveBeenCalledWith({
        professional_id: 'prof-1',
        start_date: '2026-09-01T03:00:00.000Z',
        end_date: '2026-09-20T15:00:00.000Z',
        tenant_id: 'tenant-1',
      });
    });

    it('rejeita profissional em branco sem consultar o adaptador', async () => {
      await expect(
        repository.obterItensComissaoProfissional({ professional_id: ' ' })
      ).rejects.toBeInstanceOf(ComissaoValidationError);
      expect(mockAdapter.obterItensComissao).not.toHaveBeenCalled();
    });

    it('rejeita período invertido sem consultar o adaptador', async () => {
      await expect(
        repository.obterItensComissaoProfissional({
          professional_id: 'prof-1',
          start_date: '2026-09-20T00:00:00.000Z',
          end_date: '2026-09-01T00:00:00.000Z',
        })
      ).rejects.toBeInstanceOf(ComissaoValidationError);
      expect(mockAdapter.obterItensComissao).not.toHaveBeenCalled();
    });

    it('propaga a recusa de acesso do banco', async () => {
      vi.mocked(mockAdapter.obterItensComissao).mockRejectedValueOnce(new Error('Acesso negado para este extrato.'));

      await expect(
        repository.obterItensComissaoProfissional({ professional_id: 'prof-colega' })
      ).rejects.toThrow('Acesso negado para este extrato.');
    });
  });
});
