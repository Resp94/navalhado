import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";
import { validCardBrand, validCardLast4 } from "../_shared/card_format.ts";
import { createMercadoPagoProvider } from "../_shared/mercadopago_provider.ts";
import type { PaymentProvider, ProviderPayment } from "../_shared/payment_provider.ts";

// Webhook do Mercado Pago (spec 052, ticket 05). Publico: o Mercado Pago nao manda JWT do
// Supabase, entao a funcao e publicada sem verificacao de JWT e a autenticidade vem da assinatura
// secreta do aviso (x-signature), conferida com o segredo guardado em secret do Supabase.
//
// Cada aviso e gravado com chave unica (aviso repetido e ignorado) e decidido pelo que o Mercado
// Pago responde ao buscarmos o recurso, nunca pelo corpo do aviso. Falha nossa responde 500 para
// o Mercado Pago reenviar; aviso que nao e da conta ou de um tenant conhecido responde 200.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const hmacHex = async (secret: string, message: string): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
};

/**
 * Confere o x-signature: HMAC-SHA256 em hexadecimal do manifesto
 * `id:<data.id em minusculas>;request-id:<x-request-id>;ts:<ts>;`, com o segredo do webhook.
 * O que nao veio na notificacao (data.id, x-request-id) sai do manifesto, como o Mercado Pago documenta.
 */
const hasValidSignature = async (request: Request, secret: string, dataId: string | null): Promise<boolean> => {
  const header = request.headers.get("x-signature");
  if (!header) return false;

  const parts = new Map<string, string>();
  for (const piece of header.split(",")) {
    const [name, ...value] = piece.trim().split("=");
    if (name && value.length) parts.set(name, value.join("="));
  }
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1) return false;

  const requestId = request.headers.get("x-request-id");
  const manifest = `${dataId ? `id:${dataId.toLowerCase()};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
  return timingSafeEqual(await hmacHex(secret, manifest), v1.toLowerCase());
};

type Outcome = { status: "processed" | "ignored"; detail: string };

export interface WebhookHandlerDependencies {
  provider?: PaymentProvider;
  webhookSecret?: string;
}

export const createHandler = (dependencies: WebhookHandlerDependencies = {}) => async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const secret = dependencies.webhookSecret ?? (Deno.env.get("MP_WEBHOOK_SECRET") || "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    console.error("[mercadopago-webhook] segredo do webhook ou credenciais do Supabase não configurados");
    return jsonResponse({ error: "Webhook indisponível." }, 500);
  }

  const url = new URL(request.url);
  const queryDataId = url.searchParams.get("data.id");
  if (!(await hasValidSignature(request, secret, queryDataId))) {
    console.warn("[mercadopago-webhook] aviso recusado: assinatura inválida");
    return jsonResponse({ error: "Assinatura inválida." }, 401);
  }

  let notification: Record<string, unknown>;
  try {
    const parsed = JSON.parse(await request.text());
    notification = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return jsonResponse({ error: "Requisição inválida." }, 400);
  }

  const bodyData = notification.data && typeof notification.data === "object" ? notification.data as Record<string, unknown> : {};
  const resourceId = queryDataId ?? (bodyData.id !== undefined ? String(bodyData.id) : "");
  const topic = String(notification.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
  if (!resourceId || !topic) return jsonResponse({ error: "Aviso sem tipo ou recurso." }, 400);

  const eventKey = notification.id !== undefined && notification.id !== null
    ? `mp:${notification.id}`
    : `mp:${topic}:${resourceId}:${String(notification.action ?? "")}`;

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: recorded, error: recordError } = await supabase.rpc("record_billing_event", {
    p_event_key: eventKey,
    p_topic: topic,
    p_resource_id: resourceId,
    p_payload: notification,
  });
  if (recordError) {
    console.error("[mercadopago-webhook] falha ao gravar o aviso");
    return jsonResponse({ error: "Não foi possível gravar o aviso." }, 500);
  }
  if (recorded === "duplicate") return jsonResponse({ status: "duplicate" });

  const provider = dependencies.provider ?? createMercadoPagoProvider({ accessToken: Deno.env.get("MP_ACCESS_TOKEN") || "" });

  const finish = async (status: "processed" | "ignored" | "failed", detail: string): Promise<boolean> => {
    const { error } = await supabase.rpc("finish_billing_event", { p_event_key: eventKey, p_status: status, p_detail: detail });
    if (error) console.error("[mercadopago-webhook] falha ao concluir o aviso");
    return !error;
  };

  let outcome: Outcome;
  try {
    outcome = await processNotification(supabase, provider, topic, resourceId);
  } catch (error) {
    console.error("[mercadopago-webhook] falha ao processar o aviso:", error instanceof Error ? error.message : "erro");
    await finish("failed", error instanceof Error ? error.message : "erro");
    return jsonResponse({ error: "Não foi possível processar o aviso." }, 500);
  }

  if (!(await finish(outcome.status, outcome.detail))) {
    return jsonResponse({ error: "Não foi possível concluir o aviso." }, 500);
  }
  return jsonResponse({ status: outcome.status });
};

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const processNotification = async (
  supabase: SupabaseClient,
  provider: PaymentProvider,
  topic: string,
  resourceId: string,
): Promise<Outcome> => {
  if (topic === "payment") return await processPayment(supabase, provider, resourceId);
  if (topic === "subscription_preapproval") return await processSubscription(supabase, provider, resourceId);
  if (topic === "subscription_authorized_payment") {
    return { status: "ignored", detail: "coberto pelo aviso de pagamento" };
  }
  return { status: "ignored", detail: `tópico não tratado: ${topic}`.slice(0, 200) };
};

const processPayment = async (supabase: SupabaseClient, provider: PaymentProvider, paymentId: string): Promise<Outcome> => {
  const payment = await provider.getPayment(paymentId);

  // Ao autorizar a assinatura o Mercado Pago cria um pagamento de validacao do cartao (valor 0,
  // sem external_reference nem metadata). Nao e cobranca e nao aponta para barbearia nenhuma.
  if (payment.operationType === "card_validation") {
    return { status: "ignored", detail: "validação de cartão (sem cobrança)" };
  }

  let tenantId: string | null = null;
  if (payment.subscriptionId) {
    const { data, error } = await supabase.rpc("get_tenant_by_mp_subscription", { p_mp_subscription_id: payment.subscriptionId });
    if (error) throw new Error("Falha ao buscar a barbearia da assinatura");
    tenantId = typeof data === "string" ? data : null;
  }
  if (!tenantId && payment.externalReference && UUID_PATTERN.test(payment.externalReference)) {
    tenantId = payment.externalReference;
  }
  if (!tenantId) {
    return {
      status: "ignored",
      detail: `pagamento sem barbearia conhecida (status=${payment.status}, valor=${payment.amount}, external_reference=${
        payment.externalReference ?? "-"
      }, assinatura=${payment.subscriptionId ?? "-"})`.slice(0, 300),
    };
  }

  const { data: result, error } = await supabase.rpc("apply_subscription_payment", {
    p_tenant_id: tenantId,
    p_mp_payment_id: payment.id,
    p_mp_subscription_id: payment.subscriptionId ?? null,
    p_status: payment.status,
    p_amount: payment.amount,
    p_charged_at: (payment.approvedAt ?? payment.createdAt).toISOString(),
    p_kind: payment.kind,
    p_card_brand: payment.cardBrand ?? null,
    p_card_last4: payment.cardLast4 ?? null,
  });
  if (error) throw new Error("Falha ao aplicar o pagamento na assinatura");

  const detail = String(result ?? "");
  if (detail.startsWith("ignored")) return { status: "ignored", detail };

  // O upgrade aprovado troca o plano na resposta da funcao de cobranca. Se a aprovacao chegou depois (em
  // analise que o Mercado Pago aprova mais tarde, falha do banco depois da cobranca, timeout), e aqui que o
  // plano troca. Vale para toda cobranca de upgrade aprovada, tambem a que ja estava no historico: o banco
  // nao aplica duas vezes o mesmo pagamento, e o reenvio de um aviso que falhou completa o que faltou.
  if (payment.kind === "upgrade" && payment.status === "approved" && payment.planId && UUID_PATTERN.test(payment.planId)) {
    return { status: "processed", detail: `${detail}; ${await completeUpgrade(supabase, provider, tenantId, payment, payment.planId)}` };
  }
  return { status: "processed", detail };
};

// Erros do banco que sao regra de negocio (plano inexistente ou que ja nao e mais alto, assinatura que nao
// troca mais, profissionais que nao cabem): repetir o aviso nao muda a resposta.
const UPGRADE_REFUSALS = new Set(["22023", "53400", "55000"]);

const completeUpgrade = async (
  supabase: SupabaseClient,
  provider: PaymentProvider,
  tenantId: string,
  payment: ProviderPayment,
  planId: string,
): Promise<string> => {
  const { data: contextRows, error: contextError } = await supabase.rpc("get_plan_change_context", {
    p_tenant_id: tenantId,
    p_plan_id: planId,
  });
  if (contextError) throw new Error("Falha ao ler o plano do upgrade");
  const plan = Array.isArray(contextRows) ? contextRows[0] : contextRows;
  if (!plan) return "upgrade para plano desconhecido";

  const { data: applied, error: applyError } = await supabase.rpc("apply_plan_change", {
    p_tenant_id: tenantId,
    p_plan_id: planId,
    p_mp_payment_id: payment.id,
    p_amount: payment.amount,
    p_charged_at: (payment.approvedAt ?? payment.createdAt).toISOString(),
    p_card_brand: validCardBrand(payment.cardBrand),
    p_card_last4: validCardLast4(payment.cardLast4),
  });
  if (applyError) {
    if (!UPGRADE_REFUSALS.has(String(applyError.code))) throw new Error("Falha ao aplicar o upgrade aprovado");
    console.warn(
      `[mercadopago-webhook] Upgrade aprovado não aplicado (pagamento ${payment.id}, tenant ${tenantId}, código ${applyError.code})`,
    );
    return `upgrade aprovado não aplicado (${applyError.code})`;
  }
  if (applied !== "changed") return `upgrade ${String(applied ?? "")}`;

  // O preco cheio do plano novo vale a partir da proxima cobranca. O plano ja trocou e o aviso nao se repete
  // (o banco marca o pagamento como aplicado): se o Mercado Pago nao aceitar o valor agora, o que resta e registrar.
  if (plan.mp_subscription_id) {
    try {
      await provider.changeAmount(String(plan.mp_subscription_id), Number(plan.target_plan_price));
    } catch (error) {
      console.error(
        `[mercadopago-webhook] Plano trocado (tenant ${tenantId}, plano ${planId}), mas o valor da assinatura no Mercado Pago não foi atualizado: ${
          error instanceof Error ? error.message : "erro"
        }`,
      );
      return "upgrade changed (valor da assinatura não atualizado)";
    }
  }
  return "upgrade changed";
};

const processSubscription = async (supabase: SupabaseClient, provider: PaymentProvider, subscriptionId: string): Promise<Outcome> => {
  const subscription = await provider.getSubscription(subscriptionId);
  if (subscription.status !== "authorized") {
    return { status: "ignored", detail: `assinatura ${subscription.status}` };
  }

  // A bandeira vem na assinatura (o final do cartao so vem no pagamento). A data da primeira
  // cobranca e a que o Mercado Pago calculou: pode cair depois do fim do teste, e o banco
  // estende o acesso ate la.
  const { data: found, error } = await supabase.rpc("record_subscription_authorization", {
    p_mp_subscription_id: subscription.id,
    p_card_brand: subscription.cardBrand ?? null,
    p_card_last4: subscription.cardLast4 ?? null,
    p_next_payment_at: subscription.nextPaymentAt ? subscription.nextPaymentAt.toISOString() : null,
  });
  if (error) throw new Error("Falha ao gravar a autorização da assinatura");
  return found === true
    ? { status: "processed", detail: "assinatura autorizada" }
    : { status: "ignored", detail: "assinatura desconhecida" };
};

if (import.meta.main) {
  Deno.serve(createHandler());
}
