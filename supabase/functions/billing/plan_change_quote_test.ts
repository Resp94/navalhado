import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { MINIMUM_CHARGE, type PlanChangeInput, proratedDifference, quotePlanChange } from "./plan_change_quote.ts";

// Spec 052, ticket 10: a diferenca proporcional de uma subida de plano. (preco novo - preco atual) x
// dias que faltam no periodo pago / dias do periodo, arredondada em centavos. Tesoura R$ 59,90 ->
// Maquina R$ 89,90 sao R$ 30,00 de diferenca; Maquina -> Bancada, R$ 70,00.

const DAY = 24 * 60 * 60 * 1000;
const start = new Date("2026-10-01T12:00:00.000Z");
const end30 = new Date(start.getTime() + 30 * DAY);
const end31 = new Date(start.getTime() + 31 * DAY);

// --- proratedDifference -------------------------------------------------------------------------------------

Deno.test("proratedDifference: no primeiro instante do periodo cobra a diferenca inteira", () => {
  assertEquals(proratedDifference(59.9, 89.9, start, end30, start), { difference: 30, remainingDays: 30, periodDays: 30 });
});

Deno.test("proratedDifference: no primeiro dia inteiro (ate 24h depois do pagamento) ainda cobra a diferenca inteira", () => {
  const umSegundoDepois = new Date(start.getTime() + 1000);
  const quaseUmDia = new Date(start.getTime() + DAY - 1);
  assertEquals(proratedDifference(59.9, 89.9, start, end30, umSegundoDepois).difference, 30);
  assertEquals(proratedDifference(59.9, 89.9, start, end30, quaseUmDia).difference, 30);
});

Deno.test("proratedDifference: cada dia que passa tira um trinta avos da diferenca", () => {
  const umDiaDepois = new Date(start.getTime() + DAY);
  assertEquals(proratedDifference(59.9, 89.9, start, end30, umDiaDepois), { difference: 29, remainingDays: 29, periodDays: 30 });
  const nocentro = new Date(start.getTime() + 10 * DAY);
  assertEquals(proratedDifference(59.9, 89.9, start, end30, nocentro), { difference: 20, remainingDays: 20, periodDays: 30 });
  assertEquals(proratedDifference(89.9, 159.9, start, end30, new Date(start.getTime() + 15 * DAY)).difference, 35);
});

Deno.test("proratedDifference: no ultimo dia do periodo cobra um dia", () => {
  const umaHoraAntesDoFim = new Date(end30.getTime() - 60 * 60 * 1000);
  assertEquals(proratedDifference(59.9, 89.9, start, end30, umaHoraAntesDoFim), { difference: 1, remainingDays: 1, periodDays: 30 });
});

Deno.test("proratedDifference: no fim do periodo, ou depois dele, nao sobra dia para cobrar", () => {
  assertEquals(proratedDifference(59.9, 89.9, start, end30, end30), { difference: 0, remainingDays: 0, periodDays: 30 });
  assertEquals(proratedDifference(59.9, 89.9, start, end30, new Date(end30.getTime() + 3 * DAY)).difference, 0);
});

Deno.test("proratedDifference: antes do inicio do periodo (relogio adiantado) nao passa da diferenca inteira", () => {
  assertEquals(proratedDifference(59.9, 89.9, start, end30, new Date(start.getTime() - 2 * DAY)).difference, 30);
});

Deno.test("proratedDifference: arredonda em centavos e os dias do periodo sao os do mes (31 e 28)", () => {
  // 30,00 x 12/31 = 11,6129...
  assertEquals(proratedDifference(59.9, 89.9, start, end31, new Date(end31.getTime() - 12 * DAY)), {
    difference: 11.61,
    remainingDays: 12,
    periodDays: 31,
  });
  // 30,00 x 1/31 = 0,9677...
  assertEquals(proratedDifference(59.9, 89.9, start, end31, new Date(end31.getTime() - 1000)).difference, 0.97);
  // Fevereiro: 30,00 x 14/28 = 15,00
  const fev = new Date("2027-02-01T12:00:00.000Z");
  const mar = new Date("2027-03-01T12:00:00.000Z");
  assertEquals(proratedDifference(59.9, 89.9, fev, mar, new Date(fev.getTime() + 14 * DAY)), { difference: 15, remainingDays: 14, periodDays: 28 });
});

// --- quotePlanChange ---------------------------------------------------------------------------------------

const PLANO_TESOURA = "plan-tesoura";
const PLANO_MAQUINA = "plan-maquina";
const PLANO_BANCADA = "plan-bancada";

const ativaTesouraParaMaquina: PlanChangeInput = {
  status: "active",
  currentPlanId: PLANO_TESOURA,
  currentPlanPrice: 59.9,
  targetPlanId: PLANO_MAQUINA,
  targetPlanName: "Máquina",
  targetPlanPrice: 89.9,
  targetMaxProfessionals: 5,
  activeProfessionals: 1,
  periodStart: start,
  periodEnd: end30,
  now: new Date(start.getTime() + 10 * DAY),
};

Deno.test("quotePlanChange: assinatura ativa subindo de plano cobra a diferenca proporcional e mostra o valor mensal novo", () => {
  assertEquals(quotePlanChange(ativaTesouraParaMaquina), {
    ok: true,
    mode: "charge",
    difference: 20,
    newMonthlyAmount: 89.9,
    remainingDays: 20,
    periodDays: 30,
  });
});

Deno.test("quotePlanChange: abaixo do minimo aceito pelo provedor a troca sai sem cobranca", () => {
  // 30,00 x 1/31 = 0,97: abaixo do minimo de R$ 1,00.
  const quote = quotePlanChange({ ...ativaTesouraParaMaquina, periodEnd: end31, now: new Date(end31.getTime() - 1000) });

  assertEquals(quote, { ok: true, mode: "no_charge", difference: 0, newMonthlyAmount: 89.9, remainingDays: 1, periodDays: 31 });
});

Deno.test("quotePlanChange: a diferenca igual ao minimo ja e cobrada", () => {
  // 30,00 x 1/30 = 1,00.
  const quote = quotePlanChange({ ...ativaTesouraParaMaquina, now: new Date(end30.getTime() - 1000) });

  assertEquals(quote.ok && quote.mode, "charge");
  assertEquals(quote.ok && quote.difference, MINIMUM_CHARGE);
});

Deno.test("quotePlanChange: em teste a troca e livre, sem cobranca e sem conta de dias", () => {
  const emTeste = { ...ativaTesouraParaMaquina, status: "trialing", periodStart: null, periodEnd: null };

  assertEquals(quotePlanChange(emTeste), {
    ok: true,
    mode: "free",
    difference: 0,
    newMonthlyAmount: 89.9,
    remainingDays: null,
    periodDays: null,
  });
  // Em teste tambem desce, desde que os profissionais ativos caibam.
  const descendo = { ...emTeste, currentPlanId: PLANO_MAQUINA, currentPlanPrice: 89.9, targetPlanId: PLANO_TESOURA, targetPlanPrice: 59.9, targetMaxProfessionals: 1 };
  assertEquals(quotePlanChange(descendo).ok, true);
});

Deno.test("quotePlanChange: em teste, descer para um plano menor que os profissionais ativos e recusado, com o numero na mensagem", () => {
  const quote = quotePlanChange({
    ...ativaTesouraParaMaquina,
    status: "trialing",
    currentPlanId: PLANO_BANCADA,
    currentPlanPrice: 159.9,
    targetPlanId: PLANO_TESOURA,
    targetPlanName: "Tesoura",
    targetPlanPrice: 59.9,
    targetMaxProfessionals: 1,
    activeProfessionals: 3,
  });

  assertEquals(quote.ok, false);
  assertEquals(!quote.ok && quote.code, "over_limit");
  assertEquals(!quote.ok && quote.message.includes("3 profissionais cadastrados") && quote.message.includes("Tesoura") && quote.message.includes("até 1"), true);
  assertEquals(!quote.ok && quote.message.includes("Exclua 2 profissionais"), true);
});

Deno.test("quotePlanChange: o plano em que a barbearia ja esta e recusado", () => {
  assertEquals(quotePlanChange({ ...ativaTesouraParaMaquina, targetPlanId: PLANO_TESOURA }).ok, false);
  const emTeste = { ...ativaTesouraParaMaquina, status: "trialing", targetPlanId: PLANO_TESOURA };
  const quote = quotePlanChange(emTeste);
  assertEquals(!quote.ok && quote.code, "same_plan");
});

const ativaMaquinaParaTesoura: PlanChangeInput = {
  ...ativaTesouraParaMaquina,
  currentPlanId: PLANO_MAQUINA,
  currentPlanPrice: 89.9,
  targetPlanId: PLANO_TESOURA,
  targetPlanName: "Tesoura",
  targetPlanPrice: 59.9,
  targetMaxProfessionals: 1,
};

Deno.test("quotePlanChange: na assinatura ativa, um plano mais barato e descida agendada: sem cobranca, vale na proxima cobranca", () => {
  assertEquals(quotePlanChange(ativaMaquinaParaTesoura), {
    ok: true,
    mode: "scheduled",
    difference: 0,
    newMonthlyAmount: 59.9,
    remainingDays: null,
    periodDays: null,
    effectiveAt: end30,
  });
});

Deno.test("quotePlanChange: a descida agendada nao depende do dia do periodo: sem reembolso, o valor e sempre zero", () => {
  for (const dias of [0, 15, 29]) {
    const quote = quotePlanChange({ ...ativaMaquinaParaTesoura, now: new Date(start.getTime() + dias * DAY) });
    assertEquals(quote.ok && quote.difference, 0, `dia ${dias}`);
    assertEquals(quote.ok && quote.mode, "scheduled", `dia ${dias}`);
  }
});

Deno.test("quotePlanChange: um plano de mesmo preco nao e subida nem descida", () => {
  const quote = quotePlanChange({ ...ativaTesouraParaMaquina, targetPlanPrice: 59.9 });

  assertEquals(!quote.ok && quote.code, "same_price");
});

// A cotacao nao conhece a descida que ja esta agendada: pedir de novo o mesmo plano (clique repetido, retentativa depois de
// uma falha com o Mercado Pago) cota como qualquer descida, e o banco responde "unchanged" (ver os testes da funcao).
Deno.test("quotePlanChange: na Bancada, a Maquina e descida agendada (trocar o agendamento por ela e cotado como qualquer descida)", () => {
  const quote = quotePlanChange({
    ...ativaMaquinaParaTesoura,
    currentPlanId: PLANO_BANCADA,
    currentPlanPrice: 159.9,
    targetPlanId: PLANO_MAQUINA,
    targetPlanName: "Máquina",
    targetPlanPrice: 89.9,
    targetMaxProfessionals: 5,
  });

  assertEquals(quote.ok && quote.mode, "scheduled");
});

// So excluir libera vaga: o profissional inativo (is_active = false) continua contando no limite do plano. A mensagem
// manda excluir, nao desativar, senao o Gerente desativa, tenta de novo e recebe a mesma recusa.
Deno.test("quotePlanChange: descer com mais profissionais do que o plano menor aceita diz quantos precisam ser excluidos", () => {
  const tres = quotePlanChange({ ...ativaMaquinaParaTesoura, activeProfessionals: 3 });
  const dois = quotePlanChange({ ...ativaMaquinaParaTesoura, currentPlanId: PLANO_BANCADA, targetMaxProfessionals: 1, activeProfessionals: 2 });

  assertEquals(!tres.ok && tres.code, "over_limit");
  assertEquals(!tres.ok && tres.message.includes("Exclua 2 profissionais"), true);
  assertEquals(!dois.ok && dois.message.includes("Exclua 1 profissional antes"), true);
  assertEquals(!tres.ok && tres.message.includes("Desative"), false);
  assertEquals(!tres.ok && tres.message.includes("inativo"), true);
});

// A mensalidade ja foi (ou esta sendo) cobrada e o aviso do Mercado Pago ainda nao chegou: o periodo pago na tela
// ja venceu, mas a assinatura segue "ativa". Agendar ou trocar o agendamento agora valeria para o periodo que acabou
// de ser pago, e o aviso atrasado aplicaria a descida a uma mensalidade cobrada pelo valor do plano maior.
Deno.test("quotePlanChange: descer com o periodo pago ja vencido e recusado ate o aviso da mensalidade chegar", () => {
  const umaHoraDepois = quotePlanChange({ ...ativaMaquinaParaTesoura, now: new Date(end30.getTime() + 60 * 60 * 1000) });
  const noInstante = quotePlanChange({ ...ativaMaquinaParaTesoura, now: end30 });
  const umaHoraAntes = quotePlanChange({ ...ativaMaquinaParaTesoura, now: new Date(end30.getTime() - 60 * 60 * 1000) });

  assertEquals(!umaHoraDepois.ok && umaHoraDepois.code, "period_elapsed");
  assertEquals(!noInstante.ok && noInstante.code, "period_elapsed");
  assertEquals(umaHoraAntes.ok && umaHoraAntes.mode, "scheduled");
  assertEquals(!umaHoraDepois.ok && umaHoraDepois.message.includes("ainda não foi processada"), true);
});

Deno.test("quotePlanChange: subir com o periodo vencido nao muda (os dias que faltam sao zero e o plano troca sem cobranca)", () => {
  const quote = quotePlanChange({ ...ativaTesouraParaMaquina, now: new Date(end30.getTime() + 60 * 60 * 1000) });

  assertEquals(quote.ok && quote.mode, "no_charge");
});

Deno.test("quotePlanChange: a descida agendada precisa do fim do periodo pago para dizer quando vale", () => {
  const quote = quotePlanChange({ ...ativaMaquinaParaTesoura, periodStart: null, periodEnd: null });

  assertEquals(!quote.ok && quote.code, "no_period");
});

for (const status of ["past_due", "blocked", "canceled", "courtesy", "desconhecida"]) {
  Deno.test(`quotePlanChange: assinatura ${status} nao troca de plano`, () => {
    const quote = quotePlanChange({ ...ativaTesouraParaMaquina, status });

    assertEquals(quote.ok, false);
    assertEquals(!quote.ok && quote.code, "status");
  });
}

Deno.test("quotePlanChange: assinatura ativa sem periodo pago nao tem como calcular a diferenca", () => {
  const quote = quotePlanChange({ ...ativaTesouraParaMaquina, periodStart: null, periodEnd: null });

  assertEquals(!quote.ok && quote.code, "no_period");
});
