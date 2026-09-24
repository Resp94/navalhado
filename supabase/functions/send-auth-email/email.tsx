// Spec 049: monta o e-mail (assunto, HTML e texto puro) a partir do payload
// do Send Email Hook. Um template por email_action_type suportado; tipo
// fora desta lista (magiclink, invite, email_change, reauthentication) nao
// e usado por nenhum fluxo do app -- erro explicito em vez de template
// generico.
//
// A logo usa a origem de redirect_to, nao site_url: provado com envio real
// no dev que site_url e a URL da API GoTrue (ex. .../auth/v1), nao o site
// do app -- usa-lo gerava um link de logo quebrado.
import { render } from "react-email";
import { ConfirmacaoEmail } from "./emails/confirmacao.tsx";
import { RedefinicaoSenhaEmail } from "./emails/redefinicao-senha.tsx";

export interface SendEmailHookPayload {
  user: { email: string };
  email_data: {
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

export interface EmailMontado {
  assunto: string;
  html: string;
  texto: string;
}

export type MontarEmailResultado = { ok: true; email: EmailMontado } | { ok: false; erro: string };

function montarLinkVerificacao(supabaseUrl: string, tokenHash: string, tipo: string, redirectTo: string): string {
  const params = new URLSearchParams({ token: tokenHash, type: tipo, redirect_to: redirectTo });
  return `${supabaseUrl}/auth/v1/verify?${params.toString()}`;
}

export async function montarEmail(payload: SendEmailHookPayload, supabaseUrl: string): Promise<MontarEmailResultado> {
  const { email_action_type: tipo, token_hash: tokenHash, redirect_to: redirectTo } = payload.email_data;
  const logoUrl = `${new URL(redirectTo).origin}/email/logo.png`;
  const url = montarLinkVerificacao(supabaseUrl, tokenHash, tipo, redirectTo);

  if (tipo === "recovery") {
    const email = <RedefinicaoSenhaEmail logoUrl={logoUrl} url={url} />;
    return {
      ok: true,
      email: {
        assunto: "Redefina sua senha do Navalhado",
        html: await render(email),
        texto: await render(email, { plainText: true }),
      },
    };
  }

  if (tipo === "signup") {
    const email = <ConfirmacaoEmail logoUrl={logoUrl} url={url} />;
    return {
      ok: true,
      email: {
        assunto: "Confirme seu e-mail no Navalhado",
        html: await render(email),
        texto: await render(email, { plainText: true }),
      },
    };
  }

  return { ok: false, erro: `tipo de e-mail nao suportado: ${tipo}` };
}
