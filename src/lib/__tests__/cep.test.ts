import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatCep, cleanCepDigits, fetchAddressByCep } from '../cep';

describe('CEP Utils & Services', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatCep', () => {
    it('formata 8 dígitos numéricos com traço', () => {
      expect(formatCep('01310100')).toBe('01310-100');
    });

    it('mantém formatação já existente', () => {
      expect(formatCep('01310-100')).toBe('01310-100');
    });

    it('retorna prefixo caso tenha menos de 6 dígitos', () => {
      expect(formatCep('01310')).toBe('01310');
    });
  });

  describe('cleanCepDigits', () => {
    it('remove caracteres não numéricos e limita a 8 dígitos', () => {
      expect(cleanCepDigits('01310-100')).toBe('01310100');
      expect(cleanCepDigits('01.310-10099')).toBe('01310100');
    });
  });

  describe('fetchAddressByCep', () => {
    it('retorna null se CEP for inválido ou tiver menos de 8 dígitos', async () => {
      const result = await fetchAddressByCep('123');
      expect(result).toBeNull();
    });

    it('retorna endereço via ViaCEP quando bem-sucedido', async () => {
      const mockViaCepResponse = {
        ok: true,
        json: async () => ({
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          bairro: 'Bela Vista',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockViaCepResponse as any);

      const result = await fetchAddressByCep('01310100');
      expect(result).toEqual({
        cep: '01310-100',
        street: 'Avenida Paulista',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      });
    });

    it('aciona fallback BrasilAPI quando ViaCEP falha ou retorna erro', async () => {
      // 1ª chamada (ViaCEP) falha
      const mockViaCepFail = {
        ok: true,
        json: async () => ({ erro: true }),
      };
      // 2ª chamada (BrasilAPI) tem sucesso
      const mockBrasilApiSuccess = {
        ok: true,
        json: async () => ({
          cep: '69005010',
          street: 'Rua Barão de São Domingos',
          neighborhood: 'Centro',
          city: 'Manaus',
          state: 'AM',
        }),
      };

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockViaCepFail as any)
        .mockResolvedValueOnce(mockBrasilApiSuccess as any);

      const result = await fetchAddressByCep('69005-010');
      expect(result).toEqual({
        cep: '69005-010',
        street: 'Rua Barão de São Domingos',
        neighborhood: 'Centro',
        city: 'Manaus',
        state: 'AM',
      });
    });

    it('trata adequadamente CEP de município com logradouro único (rua vazia)', async () => {
      const mockSingleCepCity = {
        ok: true,
        json: async () => ({
          cep: '13920-000',
          logradouro: '',
          bairro: '',
          localidade: 'Pedreira',
          uf: 'SP',
        }),
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockSingleCepCity as any);

      const result = await fetchAddressByCep('13920-000');
      expect(result).toEqual({
        cep: '13920-000',
        street: '',
        neighborhood: '',
        city: 'Pedreira',
        state: 'SP',
      });
    });
  });
});
