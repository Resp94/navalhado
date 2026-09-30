// Spec 052, ticket 08: handler da funcao send-billing-email. Quem chama e o cron do banco (a cada 5
// minutos, so quando ha aviso pendente), com o segredo do Vault no cabecalho x-db-trigger-secret; o
// banco confere o segredo. O handler pede os pendentes a claim_billing_notices (que ja descarta o
// que deixou de valer), monta cada e-mail, envia uma mensagem por destinatario pelo Resend e
// conclui cada aviso com finish_billing_notice. O banco e o Resend entram por deps, para teste.
//
// Um aviso que falha nao derruba os outros. Falha passageira do Resend (429, 5xx, sem rede) volta
// o aviso para a fila (ate 3 tentativas, no banco); a chave de idempotencia por destinatario evita
// mandar de novo a quem ja recebeu. Nenhum log leva endereco de e-mail, link ou corpo do e-mail.
import { type AvisoPendente, montarEmailDoAviso } from "./email.tsx";

export interface EnvioResultado {
  ok: boolean;
  /** 0: nao chegou ao Resend (sem rede). */
  status: number;
}

export interface BillingEmailDeps {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  enviar: (params: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
  }) => Promise<EnvioResultado>;
}

export interface BillingEmailEnv {
  /** Endereco https do app, sem barra final (APP_URL). */
  appUrl: string;
  from: string;
  hasResendApiKey: boolean;
}

const LIMITE_POR_RODADA = 20;

/** Mesma limpeza das outras funcoes: tira um prefixo "APP_URL=" colado por engano e a barra final; exige https. */
export function limparAppUrl(bruto: string): string {
  const valor = bruto.trim();
  const semPrefixo = (valor.startsWith("APP_URL=") ? valor.slice("APP_URL=".length).trim() : valor).replace(/\/+$/, "");
  return /^https:\/\/[^\s/]+/i.test(semPrefixo) ? semPrefixo : "";
}

const resposta = (corpo: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

const passageira = (status: number): boolean => status === 0 || status === 429 || status >= 500;

type Conclusao = { resultado: "sent" | "skipped" | "retry" | "failed"; detalhe: string | null };

const enviarAviso = async (aviso: AvisoPendente, deps: BillingEmailDeps, env: BillingEmailEnv): Promise<Conclusao> => {
  if (!aviso.recipients || aviso.recipients.length === 0) {
    return { resultado: "skipped", detalhe: "sem destinatario" };
  }

  let email;
  try {
    email = await montarEmailDoAviso(aviso, env.appUrl);
  } catch (error) {
    return { resultado: "failed", detalhe: (error instanceof Error ? error.message : "erro ao montar o e-mail").slice(0, 200) };
  }

  let enviados = 0;
  let falhaPassageira: number | null = null;
  let falhaDefinitiva: number | null = null;
  for (const destinatario of aviso.recipients) {
    const envio = await deps.enviar({
      from: env.from,
      to: destinatario,
      subject: email.assunto,
      html: email.html,
      text: email.texto,
      idempotencyKey: `billing-notice:${aviso.notice_id}:${destinatario}`,
    });
    if (envio.ok) enviados += 1;
    else if (passageira(envio.status)) falhaPassageira ??= envio.status;
    else falhaDefinitiva ??= envio.status;
  }

  if (falhaPassageira !== null) return { resultado: "retry", detalhe: `Resend ${falhaPassageira}` };
  if (enviados === 0) return { resultado: "failed", detalhe: `Resend ${falhaDefinitiva}` };
  if (falhaDefinitiva !== null) {
    return { resultado: "sent", detalhe: `enviado a ${enviados} de ${aviso.recipients.length} destinatarios` };
  }
  return { resultado: "sent", detalhe: null };
};

export async function handleSendBillingEmail(request: Request, deps: BillingEmailDeps, env: BillingEmailEnv): Promise<Response> {
  if (request.method !== "POST") return resposta({ error: "Method not allowed" }, 405);

  if (!env.from || !env.appUrl || !env.hasResendApiKey) {
    console.error("[send-billing-email] configuracao ausente (remetente, APP_URL https ou chave do Resend)");
    return resposta({ error: "Envio indisponivel." }, 500);
  }

  const segredo = request.headers.get("x-db-trigger-secret") || "";
  if (!segredo) return resposta({ error: "Nao autorizado." }, 401);
  const conferido = await deps.rpc("verify_billing_notices_secret", { p_secret: segredo });
  if (conferido.error) {
    console.error("[send-billing-email] falha ao conferir o segredo do cron");
    return resposta({ error: "Envio indisponivel." }, 500);
  }
  if (conferido.data !== true) return resposta({ error: "Nao autorizado." }, 401);

  const pedido = await deps.rpc("claim_billing_notices", { p_limit: LIMITE_POR_RODADA });
  if (pedido.error) {
    console.error("[send-billing-email] falha ao pedir os avisos pendentes");
    return resposta({ error: "Envio indisponivel." }, 500);
  }

  const avisos = (Array.isArray(pedido.data) ? pedido.data : []) as AvisoPendente[];
  const totais = { claimed: avisos.length, sent: 0, skipped: 0, retry: 0, failed: 0 };

  for (const aviso of avisos) {
    const { resultado, detalhe } = await enviarAviso(aviso, deps, env);
    totais[resultado] += 1;
    // Falha definitiva sai como erro e a que volta para a fila como alerta, para quem olha os logs
    // perceber que o envio esta quebrado (chave do Resend expirada, dominio sem verificacao).
    const linha = `[send-billing-email] aviso ${aviso.notice_id} (${aviso.kind}): ${resultado}${detalhe ? ` (${detalhe})` : ""}`;
    if (resultado === "failed") console.error(linha);
    else if (resultado === "retry") console.warn(linha);
    else console.log(linha);

    const concluido = await deps.rpc("finish_billing_notice", {
      p_id: aviso.notice_id,
      p_outcome: resultado,
      p_detail: detalhe,
    });
    if (concluido.error) console.error(`[send-billing-email] falha ao concluir o aviso ${aviso.notice_id}`);
  }

  return resposta(totais);
}
