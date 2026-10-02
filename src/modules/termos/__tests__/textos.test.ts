import { describe, expect, it } from 'vitest';
import { POLITICA_DE_PRIVACIDADE, TERMOS_DE_USO, VERSAO_ATUAL_DOS_TERMOS, textoDoDocumento } from '../textos';
import type { TextoLegal } from '../types';

// Spec 052, ticket 16. O texto é um rascunho técnico, revisado por advogado antes de ir para a prod: este teste confere que cada
// cláusula que a spec pede está lá e que ela diz o que o sistema faz (dias, prazos, o que fica e o que sai).

const textoCompleto = (texto: TextoLegal) => texto.secoes.flatMap((secao) => [secao.titulo, ...secao.paragrafos]).join('\n');

const paragrafosDaSecao = (texto: TextoLegal, titulo: RegExp): string => {
  const secao = texto.secoes.find((candidata) => titulo.test(candidata.titulo));
  expect(secao, `seção ${titulo}`).toBeDefined();
  return secao!.paragrafos.join('\n');
};

describe('versão dos termos', () => {
  it('é a data de publicação do texto (AAAA-MM-DD), e uma data que existe', () => {
    expect(VERSAO_ATUAL_DOS_TERMOS).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${VERSAO_ATUAL_DOS_TERMOS}T00:00:00Z`).toISOString().slice(0, 10)).toBe(VERSAO_ATUAL_DOS_TERMOS);
  });

  // O banco recusa o aceite de uma versão posterior a hoje (no fuso de São Paulo): uma versão pré-datada deixaria o Gerente preso na
  // tela de aceite, com a gravação recusada. A folga de um dia cobre o fuso do relógio da máquina que roda o teste.
  it('não é uma data futura', () => {
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(VERSAO_ATUAL_DOS_TERMOS <= amanha).toBe(true);
  });
});

describe('Termos de Uso', () => {
  // As oito cláusulas da spec 052 ("Termos e privacidade"), cada uma com o que ela precisa dizer.
  const CLAUSULAS: { nome: string; titulo: RegExp; diz: RegExp[] }[] = [
    { nome: 'preço e renovação mensal automática', titulo: /preço e renovação mensal automática/i, diz: [/mensal/, /renova/, /Mercado Pago/] },
    { nome: 'teste de 15 dias', titulo: /teste de 15 dias/i, diz: [/15 dias/, /sem cartão/, /bloqueado/] },
    { nome: 'cancelamento com acesso até o fim do período pago', titulo: /cancelamento/i, diz: [/até o fim do período já pago/, /nada é reembolsado/, /direto no Mercado Pago/] },
    { nome: 'subida de plano com cobrança proporcional', titulo: /subida de plano/i, diz: [/diferença/, /proporcional/, /dias que faltam/] },
    { nome: 'descida de plano sem reembolso', titulo: /descida de plano/i, diz: [/não cobra nem reembolsa/, /próxima cobrança/] },
    { nome: 'bloqueio no quinto dia de pagamento recusado, com os avisos prévios', titulo: /pagamento recusado.*quinto dia/i, diz: [/quinto dia/, /e-mail/, /terceiro e no quarto dia/, /bloqueado/] },
    { nome: 'guarda dos dados sem prazo, com exportação', titulo: /guarda dos dados e exportação/i, diz: [/sem prazo/, /Exportar dados/, /CSV/] },
    { nome: 'exclusão da Instância WhatsApp no sétimo dia de bloqueio', titulo: /exclusão do WhatsApp.*sétimo dia/i, diz: [/7 dias/, /exclui a conexão do WhatsApp/] },
  ];

  it.each(CLAUSULAS)('tem a cláusula de $nome', ({ titulo, diz }) => {
    const paragrafos = paragrafosDaSecao(TERMOS_DE_USO, titulo);
    for (const trecho of diz) expect(paragrafos).toMatch(trecho);
  });

  it('o bloqueio por pagamento recusado diz o que muda para os clientes da barbearia e para o WhatsApp, e que estorno bloqueia na hora', () => {
    const paragrafos = paragrafosDaSecao(TERMOS_DE_USO, /pagamento recusado.*quinto dia/i);
    expect(paragrafos).toMatch(/não conseguem marcar nem remarcar/);
    expect(paragrafos).toMatch(/cancelam os que já têm/);
    expect(paragrafos).toMatch(/nenhuma mensagem é enviada pelo WhatsApp/);
    expect(paragrafos).toMatch(/estorno ou a contestação/);
  });

  it('a exclusão do WhatsApp diz o que fica (os dados e o histórico) e que quem paga antes não perde nada', () => {
    const paragrafos = paragrafosDaSecao(TERMOS_DE_USO, /exclusão do WhatsApp.*sétimo dia/i);
    expect(paragrafos).toMatch(/demais dados ficam/);
    expect(paragrafos).toMatch(/Quem paga antes disso não perde nada/);
  });

  // O preço de cada plano mora no banco (tabela plans) e aparece no cadastro e na tela Assinatura: o texto remete a eles, para um
  // reajuste do catálogo não deixar o contrato dizendo um valor que não vale mais.
  it('não escreve valores em reais: o preço está no cadastro e na tela Assinatura', () => {
    expect(textoCompleto(TERMOS_DE_USO)).not.toMatch(/R\$|\d+,\d{2}/);
    expect(paragrafosDaSecao(TERMOS_DE_USO, /preço e renovação mensal automática/i)).toMatch(/tela Assinatura/);
  });

  // Só o Gerente aceita (o porteiro é do GerenteLayout; o Barbeiro nasce sem aceite): o texto diz isso, e não que cada usuário aceita.
  it('diz que o aceite é do Gerente, registrado com a versão e a data, e que uma versão nova precisa de um novo aceite', () => {
    const aceite = paragrafosDaSecao(TERMOS_DE_USO, /aceite e quem pode aceitar/i);
    expect(aceite).toMatch(/o Gerente declara que leu e aceita/);
    expect(aceite).toMatch(/registra o aceite do Gerente com a versão dos textos e a data/);
    expect(aceite).toMatch(/Os profissionais da barbearia usam o Navalhado nos termos contratados por ela/);
    expect(paragrafosDaSecao(TERMOS_DE_USO, /mudança destes termos/i)).toMatch(/aceitá-la/);
  });

  // O texto antigo (o `LegalModal`, removido do código) pedia o cumprimento das leis; o novo manteve a regra.
  it('mantém o dever de cumprir as leis aplicáveis e o bloqueio por uso indevido da conta', () => {
    const uso = paragrafosDaSecao(TERMOS_DE_USO, /uso da conta/i);
    expect(uso).toMatch(/cumprir as leis e regulamentações aplicáveis/);
    expect(uso).toMatch(/permite ao Navalhado bloquear o acesso da barbearia/);
  });
});

describe('Política de Privacidade', () => {
  it('diz que os dados ficam guardados sem prazo depois do cancelamento, com exportação pela tela e exclusão a pedido pelo suporte', () => {
    const paragrafos = paragrafosDaSecao(POLITICA_DE_PRIVACIDADE, /depois do cancelamento/i);
    expect(paragrafos).toMatch(/sem prazo/);
    expect(paragrafos).toMatch(/Exportar dados/);
    expect(paragrafos).toMatch(/a pedido, pelo suporte/);
  });

  it('diz que o número do cartão não passa pelo Navalhado e que só a bandeira e os quatro últimos dígitos ficam', () => {
    const paragrafos = paragrafosDaSecao(POLITICA_DE_PRIVACIDADE, /dados que tratamos/i);
    expect(paragrafos).toMatch(/número completo do cartão/);
    expect(paragrafos).toMatch(/quatro últimos dígitos/);
  });

  it('diz para que usa os dados e que só trata os necessários a essas finalidades', () => {
    const paragrafos = paragrafosDaSecao(POLITICA_DE_PRIVACIDADE, /para que usamos/i);
    expect(paragrafos).toMatch(/lembretes e confirmações pelo WhatsApp/);
    expect(paragrafos).toMatch(/Tratamos só os dados necessários/);
  });

  it('mantém a base legal e os direitos do titular da LGPD', () => {
    expect(paragrafosDaSecao(POLITICA_DE_PRIVACIDADE, /base legal/i)).toMatch(/Artigo 7º, Inciso V/);
    expect(paragrafosDaSecao(POLITICA_DE_PRIVACIDADE, /direitos do titular/i)).toMatch(/anonimização\/eliminação/);
  });

  it('não escreve valores em reais', () => {
    expect(textoCompleto(POLITICA_DE_PRIVACIDADE)).not.toMatch(/R\$|\d+,\d{2}/);
  });
});

describe.each([
  ['Termos de Uso', TERMOS_DE_USO],
  ['Política de Privacidade', POLITICA_DE_PRIVACIDADE],
])('estrutura de %s', (_nome, texto) => {
  it('tem título, e cada seção tem título e ao menos um parágrafo com texto', () => {
    expect(texto.titulo.trim()).not.toBe('');
    expect(texto.secoes.length).toBeGreaterThan(0);
    for (const secao of texto.secoes) {
      expect(secao.titulo.trim()).not.toBe('');
      expect(secao.paragrafos.length).toBeGreaterThan(0);
      for (const paragrafo of secao.paragrafos) expect(paragrafo.trim()).not.toBe('');
    }
  });

  it('as seções têm títulos diferentes entre si', () => {
    const titulos = texto.secoes.map((secao) => secao.titulo);
    expect(new Set(titulos).size).toBe(titulos.length);
  });
});

describe('textoDoDocumento', () => {
  it('devolve o texto de cada documento', () => {
    expect(textoDoDocumento('termos')).toBe(TERMOS_DE_USO);
    expect(textoDoDocumento('privacidade')).toBe(POLITICA_DE_PRIVACIDADE);
  });
});
