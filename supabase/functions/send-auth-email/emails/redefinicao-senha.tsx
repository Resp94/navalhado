import { NavalhadoEmailLayout } from "./_layout.tsx";

export interface RedefinicaoSenhaEmailProps {
  logoUrl: string;
  url: string;
}

export function RedefinicaoSenhaEmail({ logoUrl, url }: RedefinicaoSenhaEmailProps) {
  return (
    <NavalhadoEmailLayout
      logoUrl={logoUrl}
      preview="Redefina sua senha do Navalhado"
      titulo="Redefina sua senha"
      intro="Recebemos um pedido para trocar a senha da sua conta no Navalhado. Clique no botão abaixo para escolher uma nova senha."
      acao={{ rotulo: "Criar nova senha", url }}
      aviso="Se você não pediu a troca, não precisa se preocupar: ignore este e-mail e sua senha atual continua valendo."
    />
  );
}

RedefinicaoSenhaEmail.PreviewProps = {
  logoUrl: "/static/logo.png",
  url: "https://selvxobcjbkligxighlp.supabase.co/auth/v1/verify?token=pkce_abc123&type=recovery&redirect_to=https://dev.navalhado.com.br/reset-password",
} satisfies RedefinicaoSenhaEmailProps;

export default RedefinicaoSenhaEmail;
