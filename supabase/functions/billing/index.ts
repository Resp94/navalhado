import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";
import { createMercadoPagoProvider } from "../_shared/mercadopago_provider.ts";
import { type PaymentProvider, PaymentProviderError } from "../_shared/payment_provider.ts";

// Edge Function de cobranca da assinatura do Navalhado (spec 052). Acoes: "assinar" (ticket 05),
// "chave_publica" e "trocar_cartao" (ticket 09); mudar de plano e cancelar entram nos tickets 10 a 12.
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

// Mesmos formatos que record_card_change aceita. O banco recusa (SQLSTATE 22023) o que vier fora deles, e
// a troca ja feita no Mercado Pago viraria erro para o Gerente: valor fora do formato e descartado.
const validCardBrand = (value?: string): string | null => value && /^[A-Za-z0-9_]{1,40}$/.test(value) ? value : null;
const validCardLast4 = (value?: string): string | null => value && /^[0-9]{4}$/.test(value) ? value : null;

export interface BillingHandlerDependencies {
  provider?: PaymentProvider;
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
  if (action !== "assinar" && action !== "chave_publica" && action !== "trocar_cartao") {
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
  // fica em secret do Supabase como o resto da configuracao: cada ambiente tem a sua.
  // ---------------------------------------------------------------------------
  if (action === "chave_publica") {
    const publicKey = (Deno.env.get("MP_PUBLIC_KEY") || "").trim();
    if (!publicKey) {
      console.error("[billing] MP_PUBLIC_KEY não configurada");
      return jsonResponse(request, { error: "Troca de cartão indisponível." }, 500);
    }
    if (!PUBLIC_KEY_PATTERN.test(publicKey)) {
      // O log nunca repete o valor: pode ser um segredo colado no lugar errado.
      const prefix = /^(APP_USR|TEST)-/.exec(publicKey)?.[1] ?? "desconhecido";
      console.error(
        `[billing] MP_PUBLIC_KEY não tem o formato de uma Public Key (APP_USR-<uuid> ou TEST-<uuid>; prefixo ${prefix}, ${publicKey.length} caracteres). Confira que o secret não guarda o Access Token nem o Client Secret.`,
      );
      return jsonResponse(request, { error: "Troca de cartão indisponível." }, 500);
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
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(cardToken)) {
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
      // A mensagem do provedor e o status e o texto de erro do Mercado Pago (nunca o corpo do pedido): o
      // log guarda os dois para quem cuida da configuracao ver o motivo. Se o texto citar o token, ele sai.
      const status = error instanceof PaymentProviderError ? error.status : undefined;
      const detail = error instanceof Error ? error.message.split(cardToken).join("[token]") : "erro";
      console.error(`[billing] Falha do provedor ao trocar o cartão (status ${status ?? "sem resposta"}): ${detail}`);
      // So 400 e 422 dizem que o token do cartão foi recusado. Credencial errada (401, 403), assinatura ou
      // token não encontrados (404), limite de requisições (429) e queda do provedor não são culpa do
      // cartão: mandar o Gerente digitá-lo de novo não resolve.
      return status === 400 || status === 422
        ? jsonResponse(request, { error: "O Mercado Pago não aceitou o cartão. Confira os dados ou use outro cartão." }, 422)
        : jsonResponse(request, { error: "Não foi possível trocar o cartão agora. Tente de novo em instantes." }, 502);
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
