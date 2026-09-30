import { describe, expect, it } from 'vitest';
import { AssinaturaRepository } from '../AssinaturaRepository';
import { InMemoryAssinaturaAdapter } from '../adapters/InMemoryAssinaturaAdapter';
import type { Cobranca, DetalhesDaAssinatura, EstadoDeAcesso } from '../types';

// Spec 052, ticket 03: o front lê o Estado de Acesso que o banco calculou. Aqui
// só se testa o que o repositório faz com ele: repassar e contar dias.

const DIA = 24 * 60 * 60 * 1000;
const agora = new Date('2026-10-01T12:00:00Z');

const estado = (dataRelevante: Date | null): EstadoDeAcesso => ({
  acesso: 'aviso',
  motivo: 'trial',
  dataRelevante,
});

describe('AssinaturaRepository', () => {
  describe('obterEstadoDeAcesso', () => {
    it('devolve o estado que o adaptador leu', async () => {
      const fim = new Date('2026-10-04T12:00:00Z');
      const repo = new AssinaturaRepository(new InMemoryAssinaturaAdapter(estado(fim)));

      await expect(repo.obterEstadoDeAcesso()).resolves.toEqual(estado(fim));
    });

    it('devolve nulo quando o usuário não tem barbearia', async () => {
      const repo = new AssinaturaRepository(new InMemoryAssinaturaAdapter(null));

      await expect(repo.obterEstadoDeAcesso()).resolves.toBeNull();
    });

    it('propaga a falha do adaptador, para o chamador decidir o que fazer', async () => {
      const repo = new AssinaturaRepository(new InMemoryAssinaturaAdapter(new Error('sem rede')));

      await expect(repo.obterEstadoDeAcesso()).rejects.toThrow('sem rede');
    });
  });

  describe('diasRestantes', () => {
    const repo = new AssinaturaRepository(new InMemoryAssinaturaAdapter(null));

    it('conta 3 dias quando faltam exatamente 3 dias', () => {
      expect(repo.diasRestantes(estado(new Date(agora.getTime() + 3 * DIA)), agora)).toBe(3);
    });

    it('arredonda para cima: 2 dias e 1 hora contam como 3', () => {
      expect(repo.diasRestantes(estado(new Date(agora.getTime() + 2 * DIA + 3600_000)), agora)).toBe(3);
    });

    it('falta menos de um dia: conta 1', () => {
      expect(repo.diasRestantes(estado(new Date(agora.getTime() + 60_000)), agora)).toBe(1);
    });

    it('data já passada: conta 0, nunca negativo', () => {
      expect(repo.diasRestantes(estado(new Date(agora.getTime() - 2 * DIA)), agora)).toBe(0);
    });

    it('sem data relevante: nulo', () => {
      expect(repo.diasRestantes(estado(null), agora)).toBeNull();
    });
  });

  // Spec 052, ticket 05: o repositório só deixa o front abrir link https.
  describe('assinar', () => {
    it('devolve a assinatura criada pelo adaptador', async () => {
      const adapter = new InMemoryAssinaturaAdapter();
      const repo = new AssinaturaRepository(adapter);

      const criada = await repo.assinar();

      expect(criada.linkDePagamento).toBe('https://provider.test/checkout/assinatura-1');
      expect(adapter.assinaturasSolicitadas).toBe(1);
    });

    it('recusa um link que não seja https, para o front nunca navegar para um endereço estranho', async () => {
      const adapter = new InMemoryAssinaturaAdapter();
      adapter.respostaDeAssinar = {
        linkDePagamento: 'javascript:alert(1)',
        assinaturaId: 'a',
        primeiraCobrancaEm: null,
      };
      const repo = new AssinaturaRepository(adapter);

      await expect(repo.assinar()).rejects.toThrow('Não foi possível iniciar a assinatura. Tente de novo.');
    });

    it('repassa a falha do adaptador', async () => {
      const adapter = new InMemoryAssinaturaAdapter();
      adapter.respostaDeAssinar = new Error('A barbearia já tem uma assinatura ativa.');
      const repo = new AssinaturaRepository(adapter);

      await expect(repo.assinar()).rejects.toThrow('A barbearia já tem uma assinatura ativa.');
    });
  });
});

// Spec 052, ticket 06: a tela Assinatura lê a assinatura e o histórico de cobranças da própria
// barbearia. O histórico vem do que o webhook gravou; o repositório não consulta o Mercado Pago.
describe('AssinaturaRepository: detalhes e histórico', () => {
  const assinaturaA: DetalhesDaAssinatura = {
    situacao: 'active',
    plano: { id: 'plano-maquina', nome: 'Máquina', preco: 89.9 },
    planoAgendado: null,
    testeAte: new Date('2026-10-14T23:00:00Z'),
    periodoAte: new Date('2026-10-29T23:00:00Z'),
    cortesiaAte: null,
    cartao: { bandeira: 'visa', final: '5682' },
  };

  const cobranca = (id: string, cobradaEm: string): Cobranca => ({
    id,
    valor: 89.9,
    cobradaEm: new Date(cobradaEm),
    situacao: 'approved',
    tipo: 'recurring',
    cartao: { bandeira: 'visa', final: '5682' },
  });

  const montar = () => {
    const adapter = new InMemoryAssinaturaAdapter();
    adapter.definirAssinatura('tenant-a', assinaturaA);
    adapter.definirCobrancas('tenant-a', [cobranca('c1', '2026-09-29T23:00:00Z')]);
    adapter.definirCobrancas('tenant-b', [cobranca('cb', '2026-09-01T12:00:00Z')]);
    return new AssinaturaRepository(adapter);
  };

  it('lê a assinatura da própria barbearia', async () => {
    await expect(montar().obterAssinatura('tenant-a')).resolves.toEqual(assinaturaA);
  });

  it('barbearia sem assinatura devolve nulo', async () => {
    await expect(montar().obterAssinatura('tenant-b')).resolves.toBeNull();
  });

  it('lê só o histórico da própria barbearia', async () => {
    const historico = await montar().listarCobrancas('tenant-a');

    expect(historico.map((c) => c.id)).toEqual(['c1']);
  });

  it('devolve o histórico da mais recente para a mais antiga', async () => {
    const adapter = new InMemoryAssinaturaAdapter();
    adapter.definirCobrancas('tenant-a', [
      cobranca('velha', '2026-08-29T12:00:00Z'),
      cobranca('nova', '2026-10-29T12:00:00Z'),
      cobranca('meio', '2026-09-29T12:00:00Z'),
    ]);

    const historico = await new AssinaturaRepository(adapter).listarCobrancas('tenant-a');

    expect(historico.map((c) => c.id)).toEqual(['nova', 'meio', 'velha']);
  });

  it('barbearia sem cobrança tem histórico vazio', async () => {
    await expect(montar().listarCobrancas('tenant-sem-cobranca')).resolves.toEqual([]);
  });

  it('exige o id da barbearia', async () => {
    const repo = montar();

    await expect(repo.obterAssinatura(' ')).rejects.toThrow(/barbearia/i);
    await expect(repo.listarCobrancas('')).rejects.toThrow(/barbearia/i);
  });

  it('propaga a falha do adaptador', async () => {
    const adapter = new InMemoryAssinaturaAdapter();
    adapter.falharLeituraDaAssinatura(new Error('sem rede'));

    await expect(new AssinaturaRepository(adapter).obterAssinatura('tenant-a')).rejects.toThrow('sem rede');
  });
});

// Spec 052, ticket 09: trocar o cartão da assinatura.
describe('AssinaturaRepository: trocar cartão', () => {
  const montar = () => {
    const adapter = new InMemoryAssinaturaAdapter();
    return { adapter, repo: new AssinaturaRepository(adapter) };
  };

  it('manda o token e o final do cartão ao adaptador e devolve o cartão novo', async () => {
    const { adapter, repo } = montar();
    adapter.respostaDeTrocarCartao = { bandeira: 'master', final: '0604' };

    const cartao = await repo.trocarCartao('e3ed6f098462036dd2cbabe314b9de2a', '0604');

    expect(cartao).toEqual({ bandeira: 'master', final: '0604' });
    expect(adapter.cartoesTrocados).toEqual([{ token: 'e3ed6f098462036dd2cbabe314b9de2a', final: '0604' }]);
  });

  it.each([undefined, null, '', '060', '06045', 'abcd'])('final do cartão fora do formato (%j) não vai ao adaptador', async (final) => {
    const { adapter, repo } = montar();

    await repo.trocarCartao('e3ed6f098462036dd2cbabe314b9de2a', final);

    expect(adapter.cartoesTrocados).toEqual([{ token: 'e3ed6f098462036dd2cbabe314b9de2a', final: null }]);
  });

  it('não chama o adaptador sem token', async () => {
    const { adapter, repo } = montar();

    await expect(repo.trocarCartao('  ')).rejects.toThrow('Não foi possível ler o cartão. Digite os dados de novo.');
    expect(adapter.cartoesTrocados).toHaveLength(0);
  });

  it('propaga a recusa do adaptador', async () => {
    const { adapter, repo } = montar();
    adapter.respostaDeTrocarCartao = new Error('O Mercado Pago não aceitou o cartão.');

    await expect(repo.trocarCartao('e3ed6f098462036dd2cbabe314b9de2a')).rejects.toThrow('O Mercado Pago não aceitou o cartão.');
  });

  it('devolve a Public Key do adaptador', async () => {
    const { adapter, repo } = montar();
    adapter.chavePublica = 'APP_USR-public-key';

    await expect(repo.obterChavePublica()).resolves.toBe('APP_USR-public-key');
    expect(adapter.chavesPedidas).toEqual(['assinatura']);
  });

  it('a cobrança avulsa pede a Public Key dela: o token só vale para o app que o gerou', async () => {
    const { adapter, repo } = montar();
    adapter.chavePublicaDaCobranca = 'TEST-chave-da-cobranca';

    await expect(repo.obterChavePublica('cobranca')).resolves.toBe('TEST-chave-da-cobranca');
    expect(adapter.chavesPedidas).toEqual(['cobranca']);
  });

  it('Public Key vazia é falha', async () => {
    const { adapter, repo } = montar();
    adapter.chavePublica = '';

    await expect(repo.obterChavePublica()).rejects.toThrow('Não foi possível carregar o formulário do cartão. Tente de novo.');
  });
});

// Spec 052, ticket 10: subir de plano. A função de cobrança calcula a diferença proporcional (o que o
// navegador mostra é só o que ela respondeu) e cobra no cartão digitado nos campos seguros.
describe('AssinaturaRepository: mudar de plano', () => {
  const montar = () => {
    const adapter = new InMemoryAssinaturaAdapter();
    return { adapter, repo: new AssinaturaRepository(adapter) };
  };

  it('cota a troca: a diferença e o valor mensal novo vêm da função de cobrança', async () => {
    const { adapter, repo } = montar();

    const cotacao = await repo.cotarTrocaDePlano('plano-maquina');

    expect(cotacao).toEqual({
      modo: 'cobranca',
      diferenca: 20,
      valorMensalNovo: 89.9,
      diasRestantes: 20,
      diasDoPeriodo: 30,
      nomeDoPlano: 'Máquina',
      vigenteEm: null,
    });
    expect(adapter.cotacoesPedidas).toEqual(['plano-maquina']);
  });

  it('não cota nem troca sem o plano', async () => {
    const { adapter, repo } = montar();

    await expect(repo.cotarTrocaDePlano(' ')).rejects.toThrow(/plano/i);
    await expect(repo.trocarDePlano('')).rejects.toThrow(/plano/i);
    expect(adapter.cotacoesPedidas).toHaveLength(0);
    expect(adapter.trocasDePlano).toHaveLength(0);
  });

  it('troca com a diferença paga: manda o token, o final do cartão e o valor que o Gerente confirmou', async () => {
    const { adapter, repo } = montar();

    const trocado = await repo.trocarDePlano('plano-maquina', { token: ' e3ed6f098462036dd2cbabe314b9de2a ', final: '0604', valorConfirmado: 20 });

    expect(trocado).toEqual({
      planoId: 'plano-maquina',
      nomeDoPlano: 'Máquina',
      cobrado: 20,
      valorMensalNovo: 89.9,
      proximaCobrancaAtualizada: true,
      vigenteEm: null,
    });
    expect(adapter.trocasDePlano).toEqual([
      { planoId: 'plano-maquina', pagamento: { token: 'e3ed6f098462036dd2cbabe314b9de2a', final: '0604', valorConfirmado: 20 } },
    ]);
  });

  it('descer na assinatura ativa: a troca sem cartão devolve a data em que o plano menor passa a valer', async () => {
    const { adapter, repo } = montar();
    const vigenteEm = new Date('2026-10-29T23:26:22Z');
    adapter.respostaDeTrocarDePlano = {
      planoId: 'plano-tesoura',
      nomeDoPlano: 'Tesoura',
      cobrado: 0,
      valorMensalNovo: 59.9,
      proximaCobrancaAtualizada: true,
      vigenteEm,
    };

    const agendado = await repo.trocarDePlano('plano-tesoura');

    expect(agendado.vigenteEm).toEqual(vigenteEm);
    expect(adapter.trocasDePlano).toEqual([{ planoId: 'plano-tesoura', pagamento: undefined }]);
  });

  it('desfaz a descida agendada pelo adaptador', async () => {
    const { adapter, repo } = montar();

    await repo.desfazerDescidaDePlano();

    expect(adapter.descidasDesfeitas).toBe(1);
  });

  it('a recusa de desfazer a descida sobe com o motivo', async () => {
    const { adapter, repo } = montar();
    adapter.respostaDeDesfazerDescida = new Error('Não há descida de plano agendada.');

    await expect(repo.desfazerDescidaDePlano()).rejects.toThrow('Não há descida de plano agendada.');
  });

  it('troca sem cobrança (em teste, ou diferença pequena demais): não manda cartão', async () => {
    const { adapter, repo } = montar();

    await repo.trocarDePlano('plano-maquina');

    expect(adapter.trocasDePlano).toEqual([{ planoId: 'plano-maquina', pagamento: undefined }]);
  });

  it.each([undefined, null, '', '060', '06045', 'abcd'])('final do cartão fora do formato (%j) não vai ao adaptador', async (final) => {
    const { adapter, repo } = montar();

    await repo.trocarDePlano('plano-maquina', { token: 'e3ed6f098462036dd2cbabe314b9de2a', final: final as string | null, valorConfirmado: 20 });

    expect(adapter.trocasDePlano[0].pagamento?.final).toBeNull();
  });

  it('não cobra sem o token do cartão', async () => {
    const { adapter, repo } = montar();

    await expect(repo.trocarDePlano('plano-maquina', { token: '  ', final: null, valorConfirmado: 20 })).rejects.toThrow(
      'Não foi possível ler o cartão. Digite os dados de novo.',
    );
    expect(adapter.trocasDePlano).toHaveLength(0);
  });

  it('propaga a recusa da função (cartão recusado, valor que mudou, plano que não cabe)', async () => {
    const { adapter, repo } = montar();
    adapter.respostaDeTrocarDePlano = new Error('O cartão não tem saldo suficiente. O plano continua o mesmo.');

    await expect(repo.trocarDePlano('plano-maquina', { token: 'e3ed6f098462036dd2cbabe314b9de2a', final: null, valorConfirmado: 20 })).rejects.toThrow(
      'O cartão não tem saldo suficiente.',
    );
  });

  it('propaga a falha da cotação', async () => {
    const { adapter, repo } = montar();
    adapter.respostaDeCotar = new Error('Seus 3 profissionais ativos não cabem no plano Tesoura.');

    await expect(repo.cotarTrocaDePlano('plano-tesoura')).rejects.toThrow('não cabem no plano Tesoura');
  });
});
