import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";
import { createMercadoPagoProvider } from "../_shared/mercadopago_provider.ts";
import { type PaymentProvider, PaymentProviderError, type ProviderPayment } from "../_shared/payment_provider.ts";
import { validCardBrand, validCardLast4 } from "../_shared/card_format.ts";
import { quotePlanChange } from "./plan_change_quote.ts";

// Edge Function de cobranca da assinatura do Navalhado (spec 052). Acoes: "assinar" (ticket 05),
// "chave_publica" e "trocar_cartao" (ticket 09), "cotar_troca_de_plano" e "trocar_plano" (ticket 10);
// descer de plano agendado ("trocar_plano" para um plano mais barato e "desfazer_descida", ticket 11);
// cancelar entra no ticket 12.
// Toda acao exige o Gerente do proprio tenant. O token do Mercado Pago fica so em secret do Supabase.

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://dev.navalhado.com.br",
  "https://app.navalhado.com.br",
  "https://navalhado.com.br",
]);

const getCorsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://dev.navalhado.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const jsonResponse = (request: Request, body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(request), "Content-Type": "application/json" },
  });

interface BillingContext {
  user_id: string;
  tenant_id: string;
  email: string | null;
  tenant_name: string | null;
  plan_id: string;
  plan_name: string;
  plan_price: number | string;
  status: string;
  mp_subscription_id: string | null;
  first_charge_at: string | null;
}

// A Public Key do Mercado Pago tem o formato APP_USR-<uuid> (ou TEST-<uuid>). O Access Token e o Client
// Secret, que ficam ao lado dela no painel do Mercado Pago, tem outro: conferir o formato evita entregar
// um deles ao navegador de qualquer Gerente se o secret for preenchido com o valor errado.
const PUBLIC_KEY_PATTERN = /^(APP_USR|TEST)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// O token do cartao gerado nos campos seguros: so essa forma segue para o provedor (o numero de um cartao,
// por exemplo, nunca passa por aqui).
const CARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

// So 400 e 422 dizem que o token do cartao foi recusado: o Gerente confere os dados e tenta de novo.
// Credencial errada (401, 403), assinatura ou token nao encontrados (404), limite de requisicoes (429),
// queda do provedor e falta de resposta nao sao culpa do cartao: mandar o Gerente digita-lo de novo nao
// resolve, e ele recebe um texto neutro. A mensagem do provedor e o status e o texto de erro do Mercado
// Pago (nunca o corpo do pedido): o log guarda os dois para quem cuida da configuracao ver o motivo, e o
// token, se o texto o citar, sai.
const providerFailureResponse = (
  request: Request,
  error: unknown,
  cardToken: string,
  doing: string,
  neutralMessage: string,
): Response => {
  const status = error instanceof PaymentProviderError ? error.status : undefined;
  const detail = error instanceof Error ? error.message.split(cardToken).join("[token]") : "erro";
  console.error(`[billing] Falha do provedor ao ${doing} (status ${status ?? "sem resposta"}): ${detail}`);
  return status === 400 || status === 422
    ? jsonResponse(request, { error: "O Mercado Pago não aceitou o cartão. Confira os dados ou use outro cartão." }, 422)
    : jsonResponse(request, { error: neutralMessage }, 502);
};

// Por que o cartao foi recusado, em linguagem de gente. O que nao esta aqui cai no texto geral.
const REJECTION_REASONS: Record<string, string> = {
  cc_rejected_insufficient_amount: "O cartão não tem saldo suficiente.",
  cc_rejected_bad_filled_security_code: "O código de segurança do cartão não confere.",
  cc_rejected_bad_filled_date: "A validade do cartão não confere.",
  cc_rejected_bad_filled_other: "Algum dado do cartão não confere.",
  cc_rejected_call_for_authorize: "O banco precisa autorizar este pagamento. Fale com ele e tente de novo.",
  cc_rejected_card_disabled: "O cartão está desativado. Ative-o com o banco ou use outro.",
  cc_rejected_high_risk: "O pagamento foi recusado por segurança. Use outro cartão.",
  cc_rejected_max_attempts: "Muitas tentativas com este cartão. Use outro cartão.",
};

// A cobranca da diferenca que nao foi aprovada: nada muda, e a mensagem diz isso. Em analise o dinheiro
// pode ser cobrado depois, e o plano so troca com o pagamento aprovado na resposta.
const unapprovedChargeMessage = (payment: ProviderPayment): string => {
  if (payment.status === "in_process" || payment.status === "pending") {
    return "O Mercado Pago ainda está analisando o pagamento. O plano só troca quando ele for aprovado. Se a cobrança aparecer no seu cartão sem o plano mudar, fale com o suporte.";
  }
  const reason = payment.statusDetail ? REJECTION_REASONS[payment.statusDetail] : undefined;
  return reason
    ? `${reason} O plano continua o mesmo.`
    : "O pagamento foi recusado pelo cartão. O plano continua o mesmo. Confira os dados ou use outro cartão.";
};

// O que get_plan_change_context devolve (numeric chega como numero ou texto).
interface PlanChangeContext {
  status: string;
  mp_subscription_id: string | null;
  current_plan_id: string;
  current_plan_price: number | string;
  target_plan_id: string;
  target_plan_name: string;
  target_plan_price: number | string;
  target_max_professionals: number;
  current_period_start: string | null;
  current_period_end: string | null;
  active_professionals: number;
  /** Tentativas de upgrade do periodo que nao foram aprovadas (recusadas, em analise): entram na chave de idempotencia. */
  failed_upgrade_attempts?: number;
  /** Plano da descida ja agendada para a proxima cobranca, se houver. */
  scheduled_plan_id?: string | null;
}

export interface BillingHandlerDependencies {
  provider?: PaymentProvider;
  /** A hora de agora, para a diferenca proporcional. Os testes a fixam. */
  now?: () => Date;
}

export const createHandler = (dependencies: BillingHandlerDependencies = {}) => async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(request) });
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[billing] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurada");
    return jsonResponse(request, { error: "Cobrança indisponível." }, 500);
  }

  const bearer = (request.headers.get("authorization") || "").match(/^Bearer ([^\s]+)$/i);
  if (!bearer) return jsonResponse(request, { error: "Faça login para assinar." }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await supabase.auth.getUser(bearer[1]);
  if (authError || !authData?.user) return jsonResponse(request, { error: "Faça login para assinar." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Requisição inválida." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse(request, { error: "Requisição inválida." }, 400);
  }

  const action = (body as Record<string, unknown>).action;
  if (
    action !== "assinar" && action !== "chave_publica" && action !== "trocar_cartao" &&
    action !== "cotar_troca_de_plano" && action !== "trocar_plano" && action !== "desfazer_descida"
  ) {
    return jsonResponse(request, { error: "Ação desconhecida." }, 400);
  }

  // Contexto de cobranca, igual para todas as acoes.
  const { data: contextRows, error: contextError } = await supabase.rpc("get_billing_context", {
    p_user_id: authData.user.id,
  });
  if (contextError) {
    console.error("[billing] Falha ao ler o contexto de cobrança");
    return jsonResponse(request, { error: "Não foi possível ler a assinatura. Tente de novo." }, 500);
  }

  // O banco só devolve linha para o Gerente ativo de uma barbearia. Barbeiro, Gerente sem
  // barbearia e usuário inativo recebem zero linhas.
  const context = (Array.isArray(contextRows) ? contextRows[0] : contextRows) as BillingContext | undefined;
  if (!context?.tenant_id) {
    return jsonResponse(request, { error: "Somente o Gerente da barbearia pode fazer isso." }, 403);
  }

  // ---------------------------------------------------------------------------
  // Ação: chave_publica. A Public Key do Mercado Pago (que vai para o navegador, nao e segredo)
  // fica em secret do Supabase como o resto da configuracao: cada ambiente tem a sua. O token do
  // cartao so vale para o app que o gerou, entao a chave tem de ser a do app da conta que vai usa-lo:
  // "assinatura" (padrao) e a da troca de cartao; "cobranca" e a da cobranca avulsa do upgrade, que no
  // DEV usa outro app (MP_CHARGE_PUBLIC_KEY) e em prod a mesma chave.
  // ---------------------------------------------------------------------------
  if (action === "chave_publica") {
    const forCharge = (body as Record<string, unknown>).uso === "cobranca";
    const secretName = forCharge && (Deno.env.get("MP_CHARGE_PUBLIC_KEY") || "").trim() ? "MP_CHARGE_PUBLIC_KEY" : "MP_PUBLIC_KEY";
    const unavailable = forCharge ? "Pagamento indisponível." : "Troca de cartão indisponível.";
    const publicKey = (Deno.env.get(secretName) || "").trim();
    if (!publicKey) {
      console.error(`[billing] ${secretName} não configurada`);
      return jsonResponse(request, { error: unavailable }, 500);
    }
    if (!PUBLIC_KEY_PATTERN.test(publicKey)) {
      // O log nunca repete o valor: pode ser um segredo colado no lugar errado.
      const prefix = /^(APP_USR|TEST)-/.exec(publicKey)?.[1] ?? "desconhecido";
      console.error(
        `[billing] ${secretName} não tem o formato de uma Public Key (APP_USR-<uuid> ou TEST-<uuid>; prefixo ${prefix}, ${publicKey.length} caracteres). Confira que o secret não guarda o Access Token nem o Client Secret.`,
      );
      return jsonResponse(request, { error: unavailable }, 500);
    }
    return jsonResponse(request, { publicKey });
  }

  // ---------------------------------------------------------------------------
  // Ação: trocar_cartao. O navegador gera o token nos campos seguros do Mercado Pago e manda so o
  // token; o numero do cartao nunca passa por aqui. A troca nao cobra nada. Com o pagamento
  // recusado, a nova tentativa do Mercado Pago ja sai no cartao novo.
  // ---------------------------------------------------------------------------
  if (action === "trocar_cartao") {
    const rawToken = (body as Record<string, unknown>).cardToken;
    const cardToken = typeof rawToken === "string" ? rawToken.trim() : "";
    if (!CARD_TOKEN_PATTERN.test(cardToken)) {
      return jsonResponse(request, { error: "Não foi possível ler o cartão. Digite os dados de novo." }, 400);
    }
    // O Mercado Pago não devolve o final do cartão na troca (só a bandeira). O SDK devolve o final junto do
    // token, e o navegador o manda como dica de exibição para o Gerente reconhecer o cartão na tela. Só vale
    // com 4 dígitos (o resto é ignorado, sem recusar a troca), o do provedor vale mais, e a próxima cobrança
    // aprovada traz o final de verdade e o sobrescreve.
    const rawLast4 = (body as Record<string, unknown>).cardLast4;
    const hintedLast4 = validCardLast4(typeof rawLast4 === "string" ? rawLast4 : undefined);
    if (!["trialing", "active", "past_due", "blocked"].includes(context.status)) {
      return jsonResponse(request, { error: "Esta assinatura não tem cobrança para trocar o cartão." }, 409);
    }
    if (!context.mp_subscription_id) {
      return jsonResponse(request, { error: "A assinatura ainda não foi criada no Mercado Pago. Assine primeiro." }, 409);
    }

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN") || "";
    if (!dependencies.provider && !accessToken) {
      console.error("[billing] MP_ACCESS_TOKEN não configurado");
      return jsonResponse(request, { error: "Cobrança indisponível." }, 500);
    }
    const provider = dependencies.provider ?? createMercadoPagoProvider({ accessToken });

    let changed;
    try {
      changed = await provider.changeCard(context.mp_subscription_id, cardToken);
    } catch (error) {
      return providerFailureResponse(
        request,
        error,
        cardToken,
        "trocar o cartão",
        "Não foi possível trocar o cartão agora. Tente de novo em instantes.",
      );
    }

    const cardBrand = validCardBrand(changed.cardBrand);
    const cardLast4 = validCardLast4(changed.cardLast4) ?? hintedLast4;
    const { error: recordError } = await supabase.rpc("record_card_change", {
      p_tenant_id: context.tenant_id,
      p_card_brand: cardBrand,
      p_card_last4: cardLast4,
    });
    if (recordError) {
      console.error("[billing] Falha ao gravar o cartão novo depois da troca no Mercado Pago");
      return jsonResponse(request, {
        error: "O cartão foi trocado no Mercado Pago, mas não conseguimos atualizar a tela. Recarregue a página.",
      }, 500);
    }

    return jsonResponse(request, { changed: true, cardBrand, cardLast4 });
  }

  // ---------------------------------------------------------------------------
  // Ações: cotar_troca_de_plano e trocar_plano (subir de plano).
  //
  // cotar_troca_de_plano mostra ao Gerente, antes de confirmar, a diferença proporcional aos dias que
  // faltam no período pago e o valor mensal novo. trocar_plano refaz a conta no servidor (o que o
  // navegador mostra não vale como preço): em teste a troca é livre; na assinatura ativa cobra a
  // diferença num pagamento avulso, no cartão digitado nos campos seguros (só o token passa por aqui), e
  // só com o pagamento aprovado troca o plano (o limite de profissionais sobe junto) e muda o valor da
  // assinatura para a próxima cobrança. Cartão recusado: nada muda. Diferença abaixo do mínimo que o
  // Mercado Pago aceita: o plano troca sem cobrança avulsa.
  // ---------------------------------------------------------------------------
  if (action === "cotar_troca_de_plano" || action === "trocar_plano") {
    const rawPlanId = (body as Record<string, unknown>).planId;
    if (typeof rawPlanId !== "string" || !UUID_PATTERN.test(rawPlanId)) {
      return jsonResponse(request, { error: "Plano inválido." }, 400);
    }
    const planId = rawPlanId;

    const { data: planRows, error: planError } = await supabase.rpc("get_plan_change_context", {
      p_tenant_id: context.tenant_id,
      p_plan_id: planId,
    });
    if (planError) {
      console.error("[billing] Falha ao ler o contexto da troca de plano");
      return jsonResponse(request, { error: "Não foi possível ler o plano. Tente de novo." }, 500);
    }
    const plan = (Array.isArray(planRows) ? planRows[0] : planRows) as PlanChangeContext | undefined;
    if (!plan) return jsonResponse(request, { error: "Plano não encontrado." }, 404);

    const currentPrice = Number(plan.current_plan_price);
    const targetPrice = Number(plan.target_plan_price);
    if (!Number.isFinite(currentPrice) || !Number.isFinite(targetPrice)) {
      console.error("[billing] Preço do plano inválido no contexto da troca");
      return jsonResponse(request, { error: "Não foi possível calcular a diferença do plano." }, 500);
    }

    const periodStart = plan.current_period_start ? new Date(plan.current_period_start) : null;
    const periodEnd = plan.current_period_end ? new Date(plan.current_period_end) : null;
    const quote = quotePlanChange({
      status: plan.status,
      currentPlanId: plan.current_plan_id,
      currentPlanPrice: currentPrice,
      targetPlanId: plan.target_plan_id,
      targetPlanName: plan.target_plan_name,
      targetPlanPrice: targetPrice,
      targetMaxProfessionals: plan.target_max_professionals,
      activeProfessionals: plan.active_professionals,
      periodStart,
      periodEnd,
      scheduledPlanId: plan.scheduled_plan_id ?? null,
      now: (dependencies.now ?? (() => new Date()))(),
    });
    if (!quote.ok) {
      if (quote.code === "no_period") console.error("[billing] Assinatura ativa sem período pago: não dá para calcular a diferença do plano");
      return jsonResponse(request, { error: quote.message }, quote.code === "no_period" ? 500 : 409);
    }

    if (action === "cotar_troca_de_plano") {
      return jsonResponse(request, {
        mode: quote.mode,
        difference: quote.difference,
        newMonthlyAmount: quote.newMonthlyAmount,
        remainingDays: quote.remainingDays,
        periodDays: quote.periodDays,
        // So a descida agendada tem data: o fim do periodo pago, quando o plano menor passa a valer.
        effectiveAt: quote.effectiveAt?.toISOString(),
        planName: plan.target_plan_name,
      });
    }

    // Só a cobrança da diferença exige cartão e o valor confirmado na tela: em teste, ou com a diferença
    // abaixo do mínimo, a troca não cobra nada.
    const fields = body as Record<string, unknown>;
    const rawToken = fields.cardToken;
    const cardToken = typeof rawToken === "string" ? rawToken.trim() : "";
    const rawLast4 = fields.cardLast4;
    const hintedLast4 = validCardLast4(typeof rawLast4 === "string" ? rawLast4 : undefined);
    if (quote.mode === "charge") {
      if (!CARD_TOKEN_PATTERN.test(cardToken)) {
        return jsonResponse(request, { error: "Não foi possível ler o cartão. Digite os dados de novo." }, 400);
      }
      // O valor que o Gerente confirmou é o que será cobrado: se a diferença mudou desde a cotação (virou o
      // dia, o período foi renovado), a função recusa em vez de cobrar um valor que ele não viu.
      const expected = fields.expectedAmount;
      if (typeof expected !== "number" || !Number.isFinite(expected)) {
        return jsonResponse(request, { error: "Confirme o valor da diferença antes de pagar." }, 400);
      }
      if (Math.round(expected * 100) !== Math.round(quote.difference * 100)) {
        return jsonResponse(request, {
          error: "O valor da diferença mudou. Feche esta janela e abra de novo para ver o valor atual.",
        }, 409);
      }
    }

    // Credenciais: a assinatura usa MP_ACCESS_TOKEN. A cobrança avulsa usa o mesmo, a não ser que haja um
    // separado (MP_CHARGE_ACCESS_TOKEN): no DEV a API de pagamentos só aceita o token de teste do app, e só
    // com um e-mail de pagador que não seja de conta de teste (MP_CHARGE_PAYER_EMAIL). Em prod os dois
    // vêm em branco e um token só serve para tudo. Tudo é conferido antes de qualquer cobrança.
    const subscriptionToken = (Deno.env.get("MP_ACCESS_TOKEN") || "").trim();
    const chargeToken = (Deno.env.get("MP_CHARGE_ACCESS_TOKEN") || "").trim();
    const subscriptionProvider = dependencies.provider ??
      (subscriptionToken ? createMercadoPagoProvider({ accessToken: subscriptionToken }) : null);
    const chargeProvider = dependencies.provider ??
      (chargeToken || subscriptionToken ? createMercadoPagoProvider({ accessToken: chargeToken || subscriptionToken }) : null);
    if (plan.mp_subscription_id && !subscriptionProvider) {
      console.error("[billing] MP_ACCESS_TOKEN não configurado");
      return jsonResponse(request, { error: "Cobrança indisponível." }, 500);
    }

    // Descer na assinatura ativa (ticket 11): nada e cobrado nem trocado agora. O banco agenda o plano menor
    // (e quem confere de novo a situacao e se os profissionais ativos cabem) e o valor da assinatura no Mercado
    // Pago passa a ser o do plano menor, que e o que a proxima cobranca cobra. O banco vai primeiro; se o
    // Mercado Pago nao aceitar o valor, o agendamento e desfeito, para o plano e a cobranca nao ficarem em
    // desacordo (plano maior, cobranca menor).
    if (quote.mode === "scheduled" && quote.effectiveAt) {
      const { data: scheduledResult, error: scheduleError } = await supabase.rpc("schedule_plan_downgrade", {
        p_tenant_id: context.tenant_id,
        p_plan_id: planId,
      });
      if (scheduleError) {
        console.error(`[billing] Falha ao agendar a descida de plano (código ${scheduleError.code ?? "sem código"})`);
        if (scheduleError.code === "55000") {
          return jsonResponse(request, { error: "A assinatura não aceita agendar a descida de plano agora." }, 409);
        }
        if (scheduleError.code === "53400") {
          return jsonResponse(request, {
            error: "Seus profissionais ativos não cabem no plano escolhido. Desative profissionais antes de descer.",
          }, 409);
        }
        if (scheduleError.code === "22023") {
          return jsonResponse(request, { error: "Não foi possível descer para este plano." }, 409);
        }
        return jsonResponse(request, { error: "Não foi possível agendar a descida de plano. Tente de novo." }, 500);
      }

      if (plan.mp_subscription_id && subscriptionProvider) {
        try {
          await subscriptionProvider.changeAmount(plan.mp_subscription_id, targetPrice);
        } catch (error) {
          const status = error instanceof PaymentProviderError ? error.status : undefined;
          console.error(
            `[billing] Descida de plano não agendada (tenant ${context.tenant_id}, plano ${planId}): o Mercado Pago não aceitou o valor novo da assinatura (status ${status ?? "sem resposta"}): ${error instanceof Error ? error.message : "erro"}`,
          );
          // Só desfaz o que este pedido agendou: um agendamento que já existia (clique repetido) fica.
          if (scheduledResult === "scheduled") {
            const { error: undoError } = await supabase.rpc("cancel_plan_downgrade", { p_tenant_id: context.tenant_id });
            if (undoError) {
              console.error(
                `[billing] Não foi possível desfazer o agendamento da descida (tenant ${context.tenant_id}, plano ${planId}): o banco guarda a descida e o Mercado Pago segue com o valor antigo`,
              );
            }
          }
          return jsonResponse(request, { error: "Não foi possível agendar a descida de plano agora. Tente de novo em instantes." }, 502);
        }
      }

      return jsonResponse(request, {
        scheduled: true,
        planId,
        planName: plan.target_plan_name,
        effectiveAt: quote.effectiveAt.toISOString(),
        newMonthlyAmount: targetPrice,
      });
    }

    let payment: ProviderPayment | null = null;
    if (quote.mode === "charge") {
      const payerEmail = chargeToken ? (Deno.env.get("MP_CHARGE_PAYER_EMAIL") || "").trim() || context.email : context.email;
      if (!chargeProvider || !payerEmail) {
        console.error("[billing] Cobrança avulsa sem credencial do Mercado Pago ou sem e-mail do pagador");
        return jsonResponse(request, { error: "Cobrança indisponível." }, 500);
      }

      try {
        payment = await chargeProvider.chargeOnce({
          amount: quote.difference,
          cardToken,
          payerEmail,
          description: `Navalhado - subida para o plano ${plan.target_plan_name}`,
          externalReference: context.tenant_id,
          // A chave é da tentativa, não do cartão: o token é de uso único, e depois de um timeout em que o
          // Mercado Pago já aprovou o Gerente digita de novo e o SDK gera outro token; se a chave o levasse,
          // mudaria e a diferença seria cobrada outra vez. O reenvio repete a chave (o Mercado Pago devolve o
          // pagamento que já fez). Uma tentativa recusada ou em análise vai para o histórico e faz o pedido
          // seguinte mudar de chave; o período entra para a renovação contar como outra cobrança.
          idempotencyKey: `upgrade:${context.tenant_id}:${planId}:${periodEnd?.toISOString() ?? "sem-periodo"}:${
            Number(plan.failed_upgrade_attempts ?? 0)
          }`,
          kind: "upgrade",
          planId,
        });
      } catch (error) {
        return providerFailureResponse(
          request,
          error,
          cardToken,
          "cobrar a diferença do plano",
          "Não foi possível cobrar agora. Tente de novo em instantes.",
        );
      }
    }

    const chargedAmount = payment ? (payment.amount > 0 ? payment.amount : quote.difference) : 0;
    if (payment && payment.status !== "approved") {
      // A tentativa entra no histórico (recusada ou em análise). Se a gravação falhar, a resposta ao Gerente não muda.
      const { error: historyError } = await supabase.rpc("apply_subscription_payment", {
        p_tenant_id: context.tenant_id,
        p_mp_payment_id: payment.id,
        p_mp_subscription_id: null,
        p_status: payment.status,
        p_amount: chargedAmount,
        p_charged_at: (payment.approvedAt ?? payment.createdAt).toISOString(),
        p_kind: "upgrade",
        p_card_brand: validCardBrand(payment.cardBrand),
        p_card_last4: validCardLast4(payment.cardLast4) ?? hintedLast4,
      });
      if (historyError) console.error("[billing] Falha ao gravar no histórico a cobrança não aprovada da diferença do plano");
      return jsonResponse(request, { error: unapprovedChargeMessage(payment), paymentStatus: payment.status }, 402);
    }

    const { error: applyError } = await supabase.rpc(
      "apply_plan_change",
      payment
        ? {
          p_tenant_id: context.tenant_id,
          p_plan_id: planId,
          p_mp_payment_id: payment.id,
          p_amount: chargedAmount,
          p_charged_at: (payment.approvedAt ?? payment.createdAt).toISOString(),
          p_card_brand: validCardBrand(payment.cardBrand),
          p_card_last4: validCardLast4(payment.cardLast4) ?? hintedLast4,
        }
        : {
          p_tenant_id: context.tenant_id,
          p_plan_id: planId,
          p_mp_payment_id: null,
          p_amount: null,
          p_charged_at: null,
          p_card_brand: null,
          p_card_last4: null,
        },
    );
    if (applyError) {
      if (payment) {
        // O dinheiro já foi cobrado: o log diz qual pagamento ficou sem troca, para o suporte regularizar.
        console.error(
          `[billing] Diferença cobrada (pagamento ${payment.id}, tenant ${context.tenant_id}), mas o plano não foi trocado (código ${applyError.code ?? "sem código"})`,
        );
        return jsonResponse(request, {
          error: "Cobramos a diferença, mas não conseguimos trocar o plano. Fale com o suporte para regularizar.",
        }, 500);
      }
      console.error(`[billing] Falha ao trocar o plano (código ${applyError.code ?? "sem código"})`);
      if (applyError.code === "55000") {
        return jsonResponse(request, { error: "A assinatura não aceita trocar de plano agora." }, 409);
      }
      if (applyError.code === "53400") {
        return jsonResponse(request, {
          error: "Seus profissionais ativos não cabem no plano escolhido. Desative profissionais antes de trocar.",
        }, 409);
      }
      if (applyError.code === "22023") {
        return jsonResponse(request, { error: "Não foi possível trocar para este plano." }, 409);
      }
      return jsonResponse(request, { error: "Não foi possível trocar de plano. Tente de novo." }, 500);
    }

    // O preço cheio do plano novo vale a partir da próxima cobrança. O plano já trocou: se o Mercado Pago não
    // aceitar o valor novo agora, o Gerente não fica sem o que pagou, e o log diz o que conferir.
    let nextChargeUpdated = true;
    if (plan.mp_subscription_id && subscriptionProvider) {
      try {
        await subscriptionProvider.changeAmount(plan.mp_subscription_id, targetPrice);
      } catch (error) {
        nextChargeUpdated = false;
        const status = error instanceof PaymentProviderError ? error.status : undefined;
        console.error(
          `[billing] Plano trocado (tenant ${context.tenant_id}, plano ${planId}), mas o valor da assinatura no Mercado Pago não foi atualizado (status ${status ?? "sem resposta"}): ${error instanceof Error ? error.message : "erro"}`,
        );
      }
    }

    return jsonResponse(request, {
      changed: true,
      planId,
      planName: plan.target_plan_name,
      charged: chargedAmount,
      newMonthlyAmount: targetPrice,
      nextChargeUpdated,
    });
  }

  // ---------------------------------------------------------------------------
  // Ação: desfazer_descida (ticket 11). O Gerente desiste da descida agendada antes da data: o valor da
  // assinatura no Mercado Pago volta para o do plano atual e o agendamento sai. O Mercado Pago vai primeiro:
  // se ele não aceitar, o agendamento e o valor menor continuam juntos (coerentes); o contrário, o banco sem
  // agendamento e o Mercado Pago cobrando menos, deixaria o plano maior com mensalidade menor.
  // ---------------------------------------------------------------------------
  if (action === "desfazer_descida") {
    // O contexto da troca com o proprio plano atual como destino: traz a situação, o preço e o plano agendado.
    const { data: planRows, error: planError } = await supabase.rpc("get_plan_change_context", {
      p_tenant_id: context.tenant_id,
      p_plan_id: context.plan_id,
    });
    if (planError) {
      console.error("[billing] Falha ao ler o contexto da descida de plano");
      return jsonResponse(request, { error: "Não foi possível ler a assinatura. Tente de novo." }, 500);
    }
    const plan = (Array.isArray(planRows) ? planRows[0] : planRows) as PlanChangeContext | undefined;
    if (!plan || plan.status !== "active") {
      return jsonResponse(request, { error: "Só a assinatura ativa tem descida de plano para desfazer." }, 409);
    }
    if (!plan.scheduled_plan_id) {
      return jsonResponse(request, { error: "Não há descida de plano agendada." }, 409);
    }
    const currentPrice = Number(plan.current_plan_price);
    if (!Number.isFinite(currentPrice)) {
      console.error("[billing] Preço do plano inválido no contexto da descida de plano");
      return jsonResponse(request, { error: "Não foi possível desfazer a descida de plano." }, 500);
    }

    const subscriptionToken = (Deno.env.get("MP_ACCESS_TOKEN") || "").trim();
    const provider = dependencies.provider ?? (subscriptionToken ? createMercadoPagoProvider({ accessToken: subscriptionToken }) : null);
    if (plan.mp_subscription_id && !provider) {
      console.error("[billing] MP_ACCESS_TOKEN não configurado");
      return jsonResponse(request, { error: "Cobrança indisponível." }, 500);
    }
    if (plan.mp_subscription_id && provider) {
      try {
        await provider.changeAmount(plan.mp_subscription_id, currentPrice);
      } catch (error) {
        const status = error instanceof PaymentProviderError ? error.status : undefined;
        console.error(
          `[billing] Descida de plano não desfeita (tenant ${context.tenant_id}): o Mercado Pago não aceitou o valor da assinatura (status ${status ?? "sem resposta"}): ${error instanceof Error ? error.message : "erro"}`,
        );
        return jsonResponse(request, { error: "Não foi possível desfazer a descida de plano agora. Tente de novo em instantes." }, 502);
      }
    }

    const { error: cancelError } = await supabase.rpc("cancel_plan_downgrade", { p_tenant_id: context.tenant_id });
    if (cancelError) {
      console.error(
        `[billing] O valor da assinatura voltou no Mercado Pago, mas a descida agendada não foi desfeita (tenant ${context.tenant_id}, código ${cancelError.code ?? "sem código"}): confira a assinatura`,
      );
      return cancelError.code === "55000"
        ? jsonResponse(request, { error: "A assinatura não aceita desfazer a descida de plano agora." }, 409)
        : jsonResponse(request, { error: "Não foi possível desfazer a descida de plano. Tente de novo." }, 500);
    }

    return jsonResponse(request, { canceled: true });
  }

  // ---------------------------------------------------------------------------
  // Ação: assinar
  // ---------------------------------------------------------------------------
  if (context.status === "active") {
    return jsonResponse(request, { error: "A barbearia já tem uma assinatura ativa." }, 409);
  }
  if (context.status === "past_due") {
    return jsonResponse(request, { error: "Há uma cobrança pendente. Troque o cartão para regularizar." }, 409);
  }

  const amount = Number(context.plan_price);
  // Mesma limpeza da whatsapp-integration: tira um prefixo "APP_URL=" colado por engano e a barra final.
  const rawAppUrl = (Deno.env.get("APP_URL") || "").trim();
  const appUrl = (rawAppUrl.startsWith("APP_URL=") ? rawAppUrl.slice("APP_URL=".length).trim() : rawAppUrl).replace(/\/+$/, "");
  if (!Number.isFinite(amount) || amount <= 0 || !appUrl || !context.email) {
    console.error("[billing] Contexto de cobrança incompleto (valor, APP_URL ou e-mail)");
    return jsonResponse(request, { error: "Não foi possível criar a assinatura." }, 500);
  }
  // O Mercado Pago só aceita back_url https válido: APP_URL sem esquema (ou http) é erro de
  // configuração nosso, e o log diz o que corrigir sem precisar chamar o provedor.
  if (!/^https:\/\/[^\s/]+/i.test(appUrl)) {
    console.error("[billing] APP_URL precisa ser uma URL https (ex.: https://dev.navalhado.com.br)");
    return jsonResponse(request, { error: "Não foi possível criar a assinatura." }, 500);
  }

  const accessToken = Deno.env.get("MP_ACCESS_TOKEN") || "";
  if (!dependencies.provider && !accessToken) {
    console.error("[billing] MP_ACCESS_TOKEN não configurado");
    return jsonResponse(request, { error: "Cobrança indisponível." }, 500);
  }
  const provider = dependencies.provider ?? createMercadoPagoProvider({ accessToken });
  const startDate = context.first_charge_at ? new Date(context.first_charge_at) : undefined;

  // Assinar de novo não pode deixar a assinatura anterior cobrando: se ela ainda está ativa no
  // Mercado Pago (bloqueio por cartão recusado, por exemplo), a barbearia seria cobrada duas
  // vezes. Cancelar no provedor é o ticket 12; até lá, a função recusa. Pendente (nunca
  // autorizada), cancelada ou inexistente não cobram, e uma nova pode ser criada.
  if (context.mp_subscription_id) {
    try {
      const previous = await provider.getSubscription(context.mp_subscription_id);
      if (previous.status === "authorized" || previous.status === "paused") {
        return jsonResponse(request, {
          error: "A barbearia ainda tem uma assinatura anterior ativa no Mercado Pago. Fale com o suporte para trocá-la.",
        }, 409);
      }
    } catch (error) {
      if (!(error instanceof PaymentProviderError && error.status === 404)) {
        console.error("[billing] Falha do provedor ao conferir a assinatura anterior:", error instanceof Error ? error.message : "erro");
        return jsonResponse(request, { error: "Não foi possível conferir a assinatura anterior. Tente de novo." }, 502);
      }
    }
  }

  // Chave estável: o mesmo pedido no mesmo dia volta com a mesma assinatura, então um clique
  // repetido (ou de outra aba) não cria duas.
  const idempotencyKey = `assinar:${context.tenant_id}:${amount}:${startDate ? startDate.toISOString() : "agora"}:${
    new Date().toISOString().slice(0, 10)
  }`;

  console.info(`[billing] criando assinatura (back_url ${appUrl}/configuracoes?assinatura=retorno, início ${startDate ? startDate.toISOString() : "imediato"})`);
  let created;
  try {
    created = await provider.createSubscription({
      reason: `Navalhado - plano ${context.plan_name}`,
      payerEmail: context.email,
      amount,
      externalReference: context.tenant_id,
      startDate,
      backUrl: `${appUrl}/configuracoes?assinatura=retorno`,
      idempotencyKey,
    });
  } catch (error) {
    console.error("[billing] Falha do provedor ao criar a assinatura:", error instanceof Error ? error.message : "erro", `(back_url ${appUrl}/configuracoes?assinatura=retorno)`);
    return jsonResponse(request, { error: "O Mercado Pago não conseguiu criar a assinatura. Tente de novo." }, 502);
  }

  const { error: recordError } = await supabase.rpc("record_mp_subscription", {
    p_tenant_id: context.tenant_id,
    p_mp_subscription_id: created.id,
  });
  if (recordError) {
    console.error("[billing] Falha ao gravar a assinatura criada no Mercado Pago");
    return recordError.code === "55000"
      ? jsonResponse(request, { error: "A assinatura da barbearia não aceita uma nova assinatura agora." }, 409)
      : jsonResponse(request, { error: "Não foi possível gravar a assinatura. Tente de novo." }, 500);
  }

  return jsonResponse(request, {
    paymentLink: created.paymentLink,
    subscriptionId: created.id,
    firstChargeAt: startDate ? startDate.toISOString() : null,
  });
};

if (import.meta.main) {
  Deno.serve(createHandler());
}
