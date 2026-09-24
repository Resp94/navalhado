import { NavalhadoEmailLayout } from "./_layout.tsx";

export interface ConfirmacaoEmailProps {
  logoUrl: string;
  url: string;
}

// Spec 049: texto unico para gerente (se cadastrando) e barbeiro (acesso
// criado pelo gerente) -- decisao registrada na spec, nao dois textos.
export function ConfirmacaoEmail({ logoUrl, url }: ConfirmacaoEmailProps) {
  return (
    <NavalhadoEmailLayout
      logoUrl={logoUrl}
      preview="Confirme seu e-mail para acessar o Navalhado"
      titulo="Confirme seu e-mail"
      intro="Seu acesso ao Navalhado está quase pronto. Clique no botão abaixo para confirmar este e-mail. Depois é só entrar com seu e-mail e senha."
      acao={{ rotulo: "Confirmar e-mail", url }}
      aviso="Se você não esperava este e-mail, não precisa se preocupar: pode ignorá-lo com segurança."
    />
  );
}

ConfirmacaoEmail.PreviewProps = {
  logoUrl: "/static/logo.png",
  url: "https://selvxobcjbkligxighlp.supabase.co/auth/v1/verify?token=pkce_abc123&type=signup&redirect_to=https://dev.navalhado.com.br/",
} satisfies ConfirmacaoEmailProps;

export default ConfirmacaoEmail;
