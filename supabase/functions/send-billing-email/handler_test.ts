import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { type AvisoPendente } from "./email.tsx";
import {
  type BillingEmailDeps,
  type BillingEmailEnv,
  handleSendBillingEmail,
  limparAppUrl,
} from "./handler.tsx";

// Spec 052, ticket 08: o handler pede os avisos pendentes ao banco, monta cada e-mail, envia pelo
// Resend (uma mensagem por destinatario) e conclui cada aviso. Tudo injetado: o banco (rpc) e o
// Resend (enviar) sao falsos.

const SEGREDO = "segredo-do-cron";

const ENV: BillingEmailEnv = {
  appUrl: "https://dev.navalhado.com.br",
  from: "Navalhado <noreply@dev.navalhado.com.br>",
  hasResendApiKey: true,
};

const aviso = (parcial: Partial<AvisoPendente> = {}): AvisoPendente => ({
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

interface Envio {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

interface Montagem {
  avisos?: AvisoPendente[];
  segredoValido?: boolean;
  erroNoClaim?: boolean;
  /** Resposta do Resend por destinatario; o padrao e 200. */
  resend?: (envio: Envio) => { ok: boolean; status: number };
}

const montar = (config: Montagem = {}) => {
  const chamadas: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const envios: Envio[] = [];
  const deps: BillingEmailDeps = {
    rpc: (fn, args = {}) => {
      chamadas.push({ fn, args });
      if (fn === "verify_billing_notices_secret") {
        return Promise.resolve({ data: config.segredoValido ?? args.p_secret === SEGREDO, error: null });
      }
      if (fn === "claim_billing_notices") {
        return Promise.resolve(
          config.erroNoClaim ? { data: null, error: { message: "boom" } } : { data: config.avisos ?? [], error: null },
        );
      }
      return Promise.resolve({ data: null, error: null });
    },
    enviar: (envio) => {
      envios.push(envio);
      return Promise.resolve(config.resend ? config.resend(envio) : { ok: true, status: 200 });
    },
  };
  return {
    deps,
    chamadas,
    envios,
    concluidos: () => chamadas.filter((c) => c.fn === "finish_billing_notice").map((c) => c.args),
  };
};

const chamar = (deps: BillingEmailDeps, opcoes: { metodo?: string; segredo?: string | null; env?: BillingEmailEnv } = {}) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const segredo = opcoes.segredo === undefined ? SEGREDO : opcoes.segredo;
  if (segredo !== null) headers["x-db-trigger-secret"] = segredo;
  return handleSendBillingEmail(
    new Request("http://localhost/send-billing-email", {
      method: opcoes.metodo ?? "POST",
      headers,
      body: (opcoes.metodo ?? "POST") === "GET" ? undefined : "{}",
    }),
    deps,
    opcoes.env ?? ENV,
  );
};

Deno.test("so aceita POST", async () => {
  const { deps, chamadas } = montar();

  const res = await chamar(deps, { metodo: "GET" });

  assertEquals(res.status, 405);
  assertEquals(chamadas.length, 0);
});

Deno.test("sem configuracao (remetente, endereco do app ou chave do Resend), nao faz nada", async () => {
  for (const env of [{ ...ENV, from: "" }, { ...ENV, appUrl: "" }, { ...ENV, hasResendApiKey: false }]) {
    const { deps, chamadas } = montar({ avisos: [aviso()] });

    const res = await chamar(deps, { env });

    assertEquals(res.status, 500);
    assertEquals(chamadas.length, 0);
  }
});

Deno.test("sem o segredo do cron, ou com segredo errado, recusa e nao pede nenhum aviso", async () => {
  for (const segredo of [null, "errado"]) {
    const { deps, chamadas, envios } = montar({ avisos: [aviso()] });

    const res = await chamar(deps, { segredo });

    assertEquals(res.status, 401);
    assertEquals(chamadas.filter((c) => c.fn === "claim_billing_notices").length, 0);
    assertEquals(envios.length, 0);
  }
});

Deno.test("pede os pendentes, envia o e-mail montado ao Gerente e conclui o aviso como enviado", async () => {
  const { deps, chamadas, envios, concluidos } = montar({ avisos: [aviso()] });

  const res = await chamar(deps);

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { claimed: 1, sent: 1, skipped: 0, retry: 0, failed: 0 });
  assertEquals(chamadas.find((c) => c.fn === "claim_billing_notices")?.args, { p_limit: 20 });
  assertEquals(envios.length, 1);
  assertEquals(envios[0].from, ENV.from);
  assertEquals(envios[0].to, "gerente@barbearia.test");
  assertEquals(envios[0].subject, "O pagamento da sua assinatura do Navalhado foi recusado");
  assert(envios[0].html.includes("Barbearia do Zé"));
  assert(envios[0].text.includes("https://dev.navalhado.com.br/configuracoes"));
  assertEquals(envios[0].idempotencyKey, "billing-notice:n-1:gerente@barbearia.test");
  assertEquals(concluidos(), [{ p_id: "n-1", p_outcome: "sent", p_detail: null }]);
});

Deno.test("cada destinatario recebe a propria mensagem, sem ver o endereco dos outros", async () => {
  const { deps, envios } = montar({ avisos: [aviso({ recipients: ["a@barbearia.test", "b@barbearia.test"] })] });

  await chamar(deps);

  assertEquals(envios.map((e) => e.to), ["a@barbearia.test", "b@barbearia.test"]);
  assertEquals(envios.map((e) => e.idempotencyKey), ["billing-notice:n-1:a@barbearia.test", "billing-notice:n-1:b@barbearia.test"]);
});

Deno.test("aviso sem destinatario e descartado, sem enviar nada", async () => {
  const { deps, envios, concluidos } = montar({ avisos: [aviso({ recipients: [] })] });

  const res = await chamar(deps);

  assertEquals(envios.length, 0);
  assertEquals(concluidos(), [{ p_id: "n-1", p_outcome: "skipped", p_detail: "sem destinatario" }]);
  assertEquals((await res.json()).skipped, 1);
});

Deno.test("falha passageira do Resend (429, 5xx ou sem rede) volta o aviso para a fila", async () => {
  for (const status of [429, 500, 503, 0]) {
    const { deps, concluidos } = montar({ avisos: [aviso()], resend: () => ({ ok: false, status }) });

    const res = await chamar(deps);

    assertEquals(concluidos(), [{ p_id: "n-1", p_outcome: "retry", p_detail: `Resend ${status}` }]);
    assertEquals((await res.json()).retry, 1);
  }
});

Deno.test("recusa definitiva do Resend (4xx) falha o aviso, sem tentar de novo", async () => {
  const { deps, concluidos } = montar({ avisos: [aviso()], resend: () => ({ ok: false, status: 422 }) });

  const res = await chamar(deps);

  assertEquals(concluidos(), [{ p_id: "n-1", p_outcome: "failed", p_detail: "Resend 422" }]);
  assertEquals((await res.json()).failed, 1);
});

Deno.test("dois destinatarios, um recusado de vez: o aviso conta como enviado, com o registro do que falhou", async () => {
  const { deps, concluidos } = montar({
    avisos: [aviso({ recipients: ["a@barbearia.test", "b@barbearia.test"] })],
    resend: (envio) => (envio.to === "b@barbearia.test" ? { ok: false, status: 422 } : { ok: true, status: 200 }),
  });

  await chamar(deps);

  assertEquals(concluidos(), [{ p_id: "n-1", p_outcome: "sent", p_detail: "enviado a 1 de 2 destinatarios" }]);
});

Deno.test("dois destinatarios, um com falha passageira: volta para a fila (o Resend ignora o que ja foi enviado, pela chave de idempotencia)", async () => {
  const { deps, concluidos } = montar({
    avisos: [aviso({ recipients: ["a@barbearia.test", "b@barbearia.test"] })],
    resend: (envio) => (envio.to === "b@barbearia.test" ? { ok: false, status: 503 } : { ok: true, status: 200 }),
  });

  await chamar(deps);

  assertEquals(concluidos(), [{ p_id: "n-1", p_outcome: "retry", p_detail: "Resend 503" }]);
});

Deno.test("aviso que nao da para montar falha sozinho e nao derruba os outros", async () => {
  const { deps, envios, concluidos } = montar({
    avisos: [
      aviso({ notice_id: "n-1", kind: "outro" as AvisoPendente["kind"] }),
      aviso({ notice_id: "n-2", kind: "blocked", blocked_reason: "trial_expired", recipients: ["b@barbearia.test"] }),
    ],
  });

  const res = await chamar(deps);

  assertEquals(envios.map((e) => e.to), ["b@barbearia.test"]);
  assertEquals(concluidos(), [
    { p_id: "n-1", p_outcome: "failed", p_detail: "tipo de aviso nao suportado: outro" },
    { p_id: "n-2", p_outcome: "sent", p_detail: null },
  ]);
  assertEquals(await res.json(), { claimed: 2, sent: 1, skipped: 0, retry: 0, failed: 1 });
});

Deno.test("sem pendentes, responde 200 sem enviar nada", async () => {
  const { deps, envios } = montar({ avisos: [] });

  const res = await chamar(deps);

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { claimed: 0, sent: 0, skipped: 0, retry: 0, failed: 0 });
  assertEquals(envios.length, 0);
});

Deno.test("falha ao pedir os pendentes responde 500", async () => {
  const { deps, envios } = montar({ erroNoClaim: true });

  const res = await chamar(deps);

  assertEquals(res.status, 500);
  assertEquals(envios.length, 0);
});

Deno.test("os logs nao levam endereco de e-mail", async () => {
  const linhas: string[] = [];
  const originais = { log: console.log, info: console.info, error: console.error, warn: console.warn };
  const capturar = (...args: unknown[]) => linhas.push(args.map(String).join(" "));
  console.log = console.info = console.error = console.warn = capturar;
  try {
    const { deps } = montar({
      avisos: [aviso({ notice_id: "n-1" }), aviso({ notice_id: "n-2", recipients: ["b@barbearia.test"] })],
      resend: (envio) => (envio.to === "b@barbearia.test" ? { ok: false, status: 422 } : { ok: true, status: 200 }),
    });
    await chamar(deps);
  } finally {
    Object.assign(console, originais);
  }

  assert(linhas.length > 0, "esperava algum log");
  assert(linhas.every((linha) => !linha.includes("@barbearia.test")), linhas.join("\n"));
});

Deno.test("limparAppUrl: tira o prefixo colado por engano e a barra final, e exige https", () => {
  assertEquals(limparAppUrl("https://dev.navalhado.com.br"), "https://dev.navalhado.com.br");
  assertEquals(limparAppUrl("  https://dev.navalhado.com.br/ "), "https://dev.navalhado.com.br");
  assertEquals(limparAppUrl("APP_URL=https://dev.navalhado.com.br"), "https://dev.navalhado.com.br");
  assertEquals(limparAppUrl("http://dev.navalhado.com.br"), "");
  assertEquals(limparAppUrl("dev.navalhado.com.br"), "");
  assertEquals(limparAppUrl(""), "");
});

// Falha de envio precisa aparecer nos logs da funcao (nivel de erro), para quem olha os logs
// perceber que a chave do Resend expirou ou o dominio perdeu a verificacao.
Deno.test("aviso que falha de vez aparece como erro nos logs, e o que volta para a fila, como alerta", async () => {
  const erros: string[] = [];
  const alertas: string[] = [];
  const originais = { log: console.log, error: console.error, warn: console.warn };
  console.log = () => {};
  console.error = (...args: unknown[]) => erros.push(args.map(String).join(" "));
  console.warn = (...args: unknown[]) => alertas.push(args.map(String).join(" "));
  try {
    const { deps } = montar({
      avisos: [aviso({ notice_id: "n-falhou" }), aviso({ notice_id: "n-volta" })],
      resend: (envio) => (envio.idempotencyKey.startsWith("billing-notice:n-falhou") ? { ok: false, status: 422 } : { ok: false, status: 503 }),
    });
    await chamar(deps);
  } finally {
    Object.assign(console, originais);
  }

  assert(erros.some((linha) => linha.includes("n-falhou") && linha.includes("failed")), erros.join("\n"));
  assert(alertas.some((linha) => linha.includes("n-volta") && linha.includes("retry")), alertas.join("\n"));
  assert(!erros.some((linha) => linha.includes("n-volta")));
});
