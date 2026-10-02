import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { colunasDeTopo, projetarColunas } from '../../../test/fakePostgrestColunas';
import { SupabaseTermosAdapter } from '../adapters/SupabaseTermosAdapter';
import { MENSAGEM_ACEITAR_FALHOU } from '../errors';

type Linha = Record<string, unknown>;

interface Leitura {
  tabela: string;
  colunas: string;
  versao: string | null;
  limite: number | null;
}

interface ChamadaDeRpc {
  nome: string;
  argumentos: Record<string, unknown>;
}

/**
 * O que o adaptador usa do cliente do Supabase: from('terms_acceptances').select('version').eq('version', ...).limit(n) e
 * rpc('accept_terms', { p_version }). Como o PostgREST, só devolve as colunas pedidas no select. A RLS (só a própria linha) é do
 * banco, e o pgTAP 79 a prova: aqui as linhas do falso já são as do usuário logado.
 */
function clienteFalso({ linhas = [], erroNaLeitura = null, erroNoRpc = null }: { linhas?: Linha[]; erroNaLeitura?: Error | null; erroNoRpc?: Error | null } = {}) {
  const leituras: Leitura[] = [];
  const rpcs: ChamadaDeRpc[] = [];
  const client = {
    from(tabela: string) {
      return {
        select(colunas: string) {
          const estado = { versao: null as string | null, limite: null as number | null };
          const consulta = {
            eq(coluna: string, valor: string) {
              if (coluna === 'version') estado.versao = valor;
              return consulta;
            },
            limit(quantas: number) {
              estado.limite = quantas;
              return consulta;
            },
            then(resolver: (resposta: unknown) => unknown, rejeitar: (erro: unknown) => unknown) {
              leituras.push({ tabela, colunas, ...estado });
              if (erroNaLeitura) return Promise.resolve({ data: null, error: erroNaLeitura }).then(resolver, rejeitar);
              const pedidas = colunasDeTopo(colunas);
              const devolvidas = linhas
                .filter((linha) => estado.versao === null || linha.version === estado.versao)
                .slice(0, estado.limite ?? Infinity)
                .map((linha) => projetarColunas(pedidas, linha));
              return Promise.resolve({ data: devolvidas, error: null }).then(resolver, rejeitar);
            },
          };
          return consulta;
        },
      };
    },
    rpc(nome: string, argumentos: Record<string, unknown>) {
      rpcs.push({ nome, argumentos });
      return Promise.resolve({ data: null, error: erroNoRpc });
    },
  };
  return { client: client as unknown as SupabaseClient, leituras, rpcs };
}

describe('SupabaseTermosAdapter', () => {
  describe('jaAceitou', () => {
    it('é verdadeiro quando a tabela tem o aceite da versão', async () => {
      const { client } = clienteFalso({ linhas: [{ version: '2026-10-02', user_id: 'u1', accepted_at: '2026-10-02T12:00:00Z' }] });

      expect(await new SupabaseTermosAdapter(client).jaAceitou('2026-10-02')).toBe(true);
    });

    it('é falso quando só há o aceite de outra versão, ou nenhum', async () => {
      const outraVersao = clienteFalso({ linhas: [{ version: '2026-01-01' }] });
      const nenhum = clienteFalso();

      expect(await new SupabaseTermosAdapter(outraVersao.client).jaAceitou('2026-10-02')).toBe(false);
      expect(await new SupabaseTermosAdapter(nenhum.client).jaAceitou('2026-10-02')).toBe(false);
    });

    it('lê só a coluna da versão, de terms_acceptances, filtrando pela versão e pedindo uma linha', async () => {
      const { client, leituras } = clienteFalso();

      await new SupabaseTermosAdapter(client).jaAceitou('2026-10-02');

      expect(leituras).toEqual([{ tabela: 'terms_acceptances', colunas: 'version', versao: '2026-10-02', limite: 1 }]);
    });

    it('a falha da leitura sobe, para o porteiro decidir (ele abre o painel: o aceite não fecha ninguém por falha de rede)', async () => {
      const { client } = clienteFalso({ erroNaLeitura: new Error('rede fora do ar') });

      await expect(new SupabaseTermosAdapter(client).jaAceitou('2026-10-02')).rejects.toThrow('rede fora do ar');
    });
  });

  describe('aceitar', () => {
    it('chama a função accept_terms com a versão', async () => {
      const { client, rpcs } = clienteFalso();

      await new SupabaseTermosAdapter(client).aceitar('2026-10-02');

      expect(rpcs).toEqual([{ nome: 'accept_terms', argumentos: { p_version: '2026-10-02' } }]);
    });

    it('se o banco recusa, o Gerente lê a mensagem padrão, e não o texto do banco, que vai para o log com o código', async () => {
      const erroDoBanco = Object.assign(new Error('permission denied for function accept_terms'), { code: '42501', hint: 'sem hint' });
      const { client } = clienteFalso({ erroNoRpc: erroDoBanco });
      const noLog = vi.spyOn(console, 'error').mockImplementation(() => {});

      const falha = await new SupabaseTermosAdapter(client).aceitar('2026-10-02').catch((erro: Error) => erro);

      expect(falha).toBeInstanceOf(Error);
      expect((falha as Error).message).toBe(MENSAGEM_ACEITAR_FALHOU);
      expect((falha as Error).message).not.toContain('permission denied');
      expect((falha as Error).cause).toBe(erroDoBanco);
      // O objeto inteiro (código, hint), e não só a mensagem: é o que diz por que a gravação falhou.
      expect(noLog).toHaveBeenCalledWith('Erro ao gravar o aceite dos termos:', erroDoBanco);
      noLog.mockRestore();
    });
  });
});
