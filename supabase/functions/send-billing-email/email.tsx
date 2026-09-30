// Spec 052, ticket 08: monta o e-mail de um aviso da assinatura (assunto, HTML e texto puro) a
// partir do que claim_billing_notices devolveu. Um template por tipo de aviso; tipo desconhecido e
// erro explicito, em vez de um template generico. Datas no fuso da barbearia; preco em reais.
import { render } from "react-email";
import {
  AcessoBloqueadoEmail,
  FimDoTesteEmail,
  PagamentoRecusadoEmail,
  PagamentoRecusadoQuartoDiaEmail,
  PagamentoRecusadoTerceiroDiaEmail,
} from "./emails/avisos.tsx";

export type TipoDeAviso =
  | "trial_ending"
  | "payment_failed_day0"
  | "payment_failed_day3"
  | "payment_failed_day4"
  | "blocked";

/** Uma linha de claim_billing_notices. */
export interface AvisoPendente {
  notice_id: string;
  kind: TipoDeAviso;
  tenant_name: string;
  timezone: string;
  recipients: string[];
  plan_name: string;
  plan_price: number | string;
  card_brand: string | null;
  ref_at: string;
  trial_ends_at: string | null;
  blocks_at: string | null;
  blocked_reason: string | null;
}

export interface EmailMontado {
  assunto: string;
  html: string;
  texto: string;
}

const dataCurta = (iso: string | null, timezone: string): string => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: timezone, day: "2-digit", month: "2-digit" });
};

const emReais = (valor: number | string): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor));

export async function montarEmailDoAviso(aviso: AvisoPendente, appUrl: string): Promise<EmailMontado> {
  const base = {
    logoUrl: `${appUrl}/email/logo.png`,
    url: `${appUrl}/configuracoes`,
    barbearia: aviso.tenant_name,
    plano: aviso.plan_name,
    preco: emReais(aviso.plan_price),
  };
  const dataDoBloqueio = dataCurta(aviso.blocks_at, aviso.timezone);

  let assunto: string;
  let email;
  switch (aviso.kind) {
    case "trial_ending":
      assunto = "Seu período de teste do Navalhado termina em 3 dias";
      email = (
        <FimDoTesteEmail
          {...base}
          fimDoTeste={dataCurta(aviso.trial_ends_at, aviso.timezone)}
          assinaturaAutorizada={aviso.card_brand !== null}
        />
      );
      break;
    case "payment_failed_day0":
      assunto = "O pagamento da sua assinatura do Navalhado foi recusado";
      email = <PagamentoRecusadoEmail {...base} dataDoBloqueio={dataDoBloqueio} />;
      break;
    case "payment_failed_day3":
      assunto = "Faltam 2 dias para o bloqueio do seu acesso ao Navalhado";
      email = <PagamentoRecusadoTerceiroDiaEmail {...base} dataDoBloqueio={dataDoBloqueio} />;
      break;
    case "payment_failed_day4":
      assunto = "Amanhã o acesso ao Navalhado será bloqueado";
      email = <PagamentoRecusadoQuartoDiaEmail {...base} dataDoBloqueio={dataDoBloqueio} />;
      break;
    case "blocked":
      assunto = "O acesso da sua barbearia ao Navalhado foi bloqueado";
      email = <AcessoBloqueadoEmail {...base} motivo={aviso.blocked_reason} />;
      break;
    default:
      throw new Error(`tipo de aviso nao suportado: ${aviso.kind}`);
  }

  return {
    assunto,
    html: await render(email),
    texto: await render(email, { plainText: true }),
  };
}
