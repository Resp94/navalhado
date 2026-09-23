import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isValidEmailFormat, verifyEmailDomain } from '../email';

describe('isValidEmailFormat', () => {
  const validCases: [string, string][] = [
    ['joao@gmail.com', 'e-mail simples'],
    ['JOAO@GMAIL.COM', 'maiúsculas'],
    ['joao.silva@empresa.com.br', 'ponto na parte local, TLD composto'],
    ['joao.silva+agenda@empresa.com.br', 'tag com +'],
    ['joao_silva@empresa.com', 'underscore na parte local'],
    ['joao-mail@sub.dominio.com.br', 'hífen no meio do rótulo do domínio'],
    ['j@ab.co', 'TLD curto de 2 letras'],
    ['joao123@dominio123.com', 'dígitos na parte local e no domínio'],
    ['jon@email.com', 'domínio real usado como exemplo na conversa'],
    ['a.b.c@dominio.com', 'múltiplos pontos na parte local'],
  ];

  const invalidCases: [string, string][] = [
    ['jon@x', 'domínio sem ponto'],
    ['jon@x.c', 'TLD com 1 letra'],
    ['jon..a@x.com', 'ponto duplicado na parte local'],
    ['.jon@x.com', 'ponto no início da parte local'],
    ['jon.@x.com', 'ponto no fim da parte local'],
    ['jon@-x.com', 'hífen no início do rótulo do domínio'],
    ['jon@x-.com', 'hífen no fim do rótulo do domínio'],
    ['jon @x.com', 'espaço'],
    ['jon@@x.com', 'arroba duplicado'],
    ['jon@x..com', 'ponto duplicado no domínio'],
    ['jonx.com', 'sem arroba'],
    ['', 'vazio'],
  ];

  it.each(validCases)('aceita "%s" (%s)', (email) => {
    expect(isValidEmailFormat(email)).toBe(true);
  });

  it.each(invalidCases)('recusa "%s" (%s)', (email) => {
    expect(isValidEmailFormat(email)).toBe(false);
  });
});

describe('verifyEmailDomain', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const dnsResponse = (status: number, answers: { type: number; data: string }[] = []) => ({
    ok: true,
    json: async () => ({
      Status: status,
      Answer: answers.map((a) => ({ name: 'x', type: a.type, TTL: 300, data: a.data })),
    }),
  });

  it('retorna "valido" quando o domínio tem registro MX', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      dnsResponse(0, [{ type: 15, data: '10 mail.dominio-mx-ok.example.' }]) as any
    );
    expect(await verifyEmailDomain('dominio-mx-ok.example')).toBe('valido');
  });

  it('retorna "sem_mx" para NXDOMAIN (Status 3)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(dnsResponse(3) as any);
    expect(await verifyEmailDomain('dominio-inexistente.example')).toBe('sem_mx');
  });

  it('retorna "sem_mx" quando o domínio existe mas não tem registro MX', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(dnsResponse(0, []) as any);
    expect(await verifyEmailDomain('dominio-sem-mx.example')).toBe('sem_mx');
  });

  it('retorna "sem_mx" para MX nulo (RFC 7505: preferência 0 apontando para ".")', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(dnsResponse(0, [{ type: 15, data: '0 .' }]) as any);
    expect(await verifyEmailDomain('dominio-mx-nulo.example')).toBe('sem_mx');
  });

  it('usa o Google como reserva quando a Cloudflare falha', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('cloudflare fora'))
      .mockResolvedValueOnce(dnsResponse(0, [{ type: 15, data: '10 mail.dominio-fallback.example.' }]) as any);

    expect(await verifyEmailDomain('dominio-fallback.example')).toBe('valido');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('retorna "indisponivel" quando Cloudflare e Google falham, e registra aviso no console', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('cloudflare fora'))
      .mockRejectedValueOnce(new Error('google fora'));

    expect(await verifyEmailDomain('dominio-indisponivel.example')).toBe('indisponivel');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('retorna "indisponivel" quando a consulta estoura o tempo limite (abort)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const err = new DOMException('The operation was aborted.', 'AbortError');
      return Promise.reject(err);
    });
    expect(await verifyEmailDomain('dominio-timeout.example')).toBe('indisponivel');
  });

  it('guarda o resultado em cache por domínio, sem repetir a consulta', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(dnsResponse(0, [{ type: 15, data: '10 mail.dominio-cache.example.' }]) as any);

    const r1 = await verifyEmailDomain('dominio-cache.example');
    const r2 = await verifyEmailDomain('dominio-cache.example');

    expect(r1).toBe('valido');
    expect(r2).toBe('valido');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
