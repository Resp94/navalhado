import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { type AvisoPendente, montarEmailDoAviso } from "./email.tsx";

// Spec 052, ticket 08: cada aviso tem o assunto, o texto, as datas (no fuso da barbearia) e o link
// certos, no HTML e no texto puro. Os espacos que nao quebram (o do "R$ 89,90") e as quebras de linha do texto
// puro viram espaco comum antes de comparar.

const APP_URL = "https://dev.navalhado.com.br";

const semEspacoEspecial = (texto: string) => texto.replace(/ |&nbsp;/g, " ").replace(/\s+/g, " ");

const aviso = (parcial: Partial<AvisoPendente>): AvisoPendente => ({
  notice_id: "n-1",
  kind: "payment_failed_day0",
  tenant_name: "Barbearia do Zé",
  timezone: "America/Sao_Paulo",
  recipients: ["gerente@barbearia.test"],
  plan_name: "Máquina",
  plan_price: 89.9,
  card_brand: null,
  ref_at: "2040-06-01T15:00:00Z",
  trial_ends_at: null,
  blocks_at: "2040-06-06T15:00:00Z",
  blocked_reason: null,
  ...parcial,
});

const montar = async (parcial: Partial<AvisoPendente>, appUrl = APP_URL) => {
  const email = await montarEmailDoAviso(aviso(parcial), appUrl);
  return { ...email, html: semEspacoEspecial(email.html), texto: semEspacoEspecial(email.texto) };
};

Deno.test("dia da recusa: assunto, barbearia, plano, preco e a data do bloqueio", async () => {
  const email = await montar({ kind: "payment_failed_day0" });

  assertEquals(email.assunto, "O pagamento da sua assinatura do Navalhado foi recusado");
  for (const texto of [email.html, email.texto]) {
    assert(texto.includes("Barbearia do Zé"));
    assert(texto.includes("Máquina"));
    assert(texto.includes("R$ 89,90"));
    assert(texto.includes("Atualize o cartão até 06/06"));
  }
  assert(email.html.includes("Atualizar cartão"));
});

Deno.test("terceiro dia da recusa: faltam 2 dias e a data do bloqueio", async () => {
  const email = await montar({ kind: "payment_failed_day3" });

  assertEquals(email.assunto, "Faltam 2 dias para o bloqueio do seu acesso ao Navalhado");
  assert(email.texto.includes("Atualize o cartão até 06/06"));
  assert(email.texto.includes("Seus dados continuam guardados"));
});

Deno.test("quarto dia da recusa: amanha o acesso sera bloqueado", async () => {
  const email = await montar({ kind: "payment_failed_day4" });

  assertEquals(email.assunto, "Amanhã o acesso ao Navalhado será bloqueado");
  assert(email.texto.includes("amanhã (06/06)"));
});

Deno.test("as datas seguem o fuso da barbearia", async () => {
  // 03:30 UTC de 06/06: 00:30 em Brasilia (UTC-3), 23:30 de 05/06 em Manaus (UTC-4).
  const brasilia = await montar({ kind: "payment_failed_day3", blocks_at: "2040-06-06T03:30:00Z" });
  const manaus = await montar({ kind: "payment_failed_day3", blocks_at: "2040-06-06T03:30:00Z", timezone: "America/Manaus" });

  assert(brasilia.texto.includes("até 06/06"));
  assert(manaus.texto.includes("até 05/06"));
});

Deno.test("fim do teste sem cartao: a data do fim, o plano, o preco e o convite para assinar", async () => {
  const email = await montar({
    kind: "trial_ending",
    trial_ends_at: "2040-06-10T15:00:00Z",
    card_brand: null,
    blocks_at: null,
  });

  assertEquals(email.assunto, "Seu período de teste do Navalhado termina em 3 dias");
  for (const texto of [email.html, email.texto]) {
    assert(texto.includes("termina em 10/06"));
    assert(texto.includes("Máquina"));
    assert(texto.includes("R$ 89,90"));
  }
  assert(email.html.includes("Assinar agora"));
  assert(email.texto.includes("primeira cobrança só acontece no fim do teste"));
});

Deno.test("fim do teste com a assinatura ja autorizada: diz quando cobra e nao pede para assinar", async () => {
  const email = await montar({
    kind: "trial_ending",
    trial_ends_at: "2040-06-10T15:00:00Z",
    card_brand: "visa",
    blocks_at: null,
  });

  assertEquals(email.assunto, "Seu período de teste do Navalhado termina em 3 dias");
  assert(email.texto.includes("já está autorizada"));
  assert(email.texto.includes("primeira cobrança de R$ 89,90"));
  assert(email.texto.includes("10/06"));
  assert(email.html.includes("Ver minha assinatura"));
  assert(!email.html.includes("Assinar agora"));
});

const MOTIVOS: Array<[string | null, string, string]> = [
  ["trial_expired", "O período de teste de Barbearia do Zé terminou", "Assinar agora"],
  ["payment_failed", "não foi aprovado em 5 dias", "Atualizar cartão"],
  ["canceled", "foi cancelada e o período pago terminou", "Assinar de novo"],
  ["courtesy_expired", "A cortesia de Barbearia do Zé terminou", "Assinar agora"],
  ["refunded", "foi estornado", "Assinar de novo"],
  ["charged_back", "foi contestado", "Assinar de novo"],
  [null, "O acesso de Barbearia do Zé ao Navalhado foi bloqueado", "Voltar ao Navalhado"],
];

for (const [motivo, frase, botao] of MOTIVOS) {
  Deno.test(`bloqueio (${motivo ?? "sem motivo"}): diz o que aconteceu e o caminho para voltar`, async () => {
    const email = await montar({ kind: "blocked", blocked_reason: motivo, blocks_at: null });

    assertEquals(email.assunto, "O acesso da sua barbearia ao Navalhado foi bloqueado");
    assert(email.texto.includes(frase), `faltou "${frase}" em: ${email.texto}`);
    assert(email.html.includes(botao), `faltou o botao "${botao}"`);
    assert(email.texto.includes("Os dados da sua barbearia continuam guardados"));
  });
}

Deno.test("o botao e o link de texto levam para Configuracoes, e a logo vem do proprio ambiente", async () => {
  const email = await montar({ kind: "payment_failed_day0" });

  assert(email.html.includes(`href="${APP_URL}/configuracoes"`));
  assert(email.texto.includes(`${APP_URL}/configuracoes`));
  assert(email.html.includes(`src="${APP_URL}/email/logo.png"`));
});

Deno.test("o e-mail nao leva enderecos de e-mail nem dados do cartao", async () => {
  const email = await montar({ kind: "payment_failed_day0", card_brand: "visa" });

  assert(!email.html.includes("gerente@barbearia.test"));
  assert(!email.texto.includes("gerente@barbearia.test"));
});

Deno.test("tipo de aviso desconhecido e erro explicito, sem template generico", async () => {
  await assertRejects(
    () => montarEmailDoAviso(aviso({ kind: "outro" as AvisoPendente["kind"] }), APP_URL),
    Error,
    "tipo de aviso nao suportado: outro",
  );
});

// Sem a data (aviso antigo ou dado limpo entre o claim e a montagem), a frase continua inteira.
Deno.test("sem a data do bloqueio, a frase da recusa continua inteira", async () => {
  const dia0 = await montar({ kind: "payment_failed_day0", blocks_at: null });
  const dia3 = await montar({ kind: "payment_failed_day3", blocks_at: null });
  const dia4 = await montar({ kind: "payment_failed_day4", blocks_at: null });

  assert(dia0.texto.includes("Atualize o cartão para não ter o acesso bloqueado."), dia0.texto);
  assert(dia3.texto.includes("Atualize o cartão para não ter o acesso bloqueado."), dia3.texto);
  assert(dia4.texto.includes("para não perder o acesso amanhã."), dia4.texto);
  for (const email of [dia0, dia3, dia4]) {
    assert(!email.texto.includes("até  "), email.texto);
    assert(!email.texto.includes("()"), email.texto);
  }
});

Deno.test("sem a data do fim do teste, o aviso diz que o teste termina em breve", async () => {
  const semCartao = await montar({ kind: "trial_ending", trial_ends_at: null, card_brand: null });
  const comCartao = await montar({ kind: "trial_ending", trial_ends_at: null, card_brand: "visa" });

  for (const email of [semCartao, comCartao]) {
    assert(email.texto.includes("termina em breve."), email.texto);
    assert(!email.texto.includes("termina em ."), email.texto);
  }
  assert(semCartao.texto.includes("Se a assinatura não for feita até o fim do teste"), semCartao.texto);
});
