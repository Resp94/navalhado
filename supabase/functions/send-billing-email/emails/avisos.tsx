import { NavalhadoEmailLayout } from "../../_shared/emails/layout.tsx";

// Spec 052, ticket 08: os avisos da assinatura. Mesmo layout dos e-mails de autenticacao (logo,
// titulo, botao, rodape); cada aviso so escolhe o texto. Nenhum leva endereco de e-mail nem dado do
// cartao, so o que a barbearia ja ve no painel.

export interface AvisoProps {
  logoUrl: string;
  /** Endereco de Configuracoes, onde o Gerente ve e resolve a assinatura. */
  url: string;
  barbearia: string;
  plano: string;
  /** "R$ 89,90". */
  preco: string;
}

function Aviso(
  { logoUrl, url, preview, titulo, intro, botao, aviso }: {
    logoUrl: string;
    url: string;
    preview: string;
    titulo: string;
    intro: string;
    botao: string;
    aviso: string;
  },
) {
  return (
    <NavalhadoEmailLayout
      logoUrl={logoUrl}
      preview={preview}
      titulo={titulo}
      intro={intro}
      acao={{ rotulo: botao, url }}
      aviso={aviso}
    />
  );
}

// ---- Fim do teste ---------------------------------------------------------------------------------

export interface FimDoTesteProps extends AvisoProps {
  /** "10/06", no fuso da barbearia. */
  fimDoTeste: string;
  /** O cartao ja foi autorizado no Mercado Pago: a primeira cobranca sai sozinha no fim do teste. */
  assinaturaAutorizada: boolean;
}

export function FimDoTesteEmail(props: FimDoTesteProps) {
  const { barbearia, plano, preco, fimDoTeste, assinaturaAutorizada } = props;
  // Sem a data (dado que sumiu entre o claim e a montagem), a frase continua inteira.
  const quando = fimDoTeste ? `termina em ${fimDoTeste}` : "termina em breve";
  if (assinaturaAutorizada) {
    return (
      <Aviso
        {...props}
        preview={`O teste de ${barbearia} ${quando}`}
        titulo="Seu teste termina em 3 dias"
        intro={`O período de teste de ${barbearia} no Navalhado ${quando}. Como sua assinatura já está autorizada, a primeira cobrança de ${preco} (plano ${plano}) será feita nessa data. Você não precisa fazer nada.`}
        botao="Ver minha assinatura"
        aviso="Você pode ver ou mudar a assinatura em Configurações, a qualquer momento."
      />
    );
  }
  return (
    <Aviso
      {...props}
      preview={`O teste de ${barbearia} ${quando}`}
      titulo="Seu teste termina em 3 dias"
      intro={`O período de teste de ${barbearia} no Navalhado ${quando}. Para continuar usando depois dessa data, assine o plano ${plano} por ${preco} por mês. A primeira cobrança só acontece no fim do teste.`}
      botao="Assinar agora"
      aviso={`Se a assinatura não for feita até ${fimDoTeste || "o fim do teste"}, o acesso da barbearia será bloqueado. Os dados da sua barbearia continuam guardados.`}
    />
  );
}

// ---- Pagamento recusado ---------------------------------------------------------------------------

export interface PagamentoRecusadoProps extends AvisoProps {
  /** "06/06": o dia em que o acesso e bloqueado, no fuso da barbearia. Vazio se a data nao veio. */
  dataDoBloqueio: string;
}

/** " até 06/06", ou nada se a data nao veio: a frase continua inteira. */
const ateADataDoBloqueio = (dataDoBloqueio: string): string => (dataDoBloqueio ? ` até ${dataDoBloqueio}` : "");

export function PagamentoRecusadoEmail(props: PagamentoRecusadoProps) {
  const { barbearia, plano, preco, dataDoBloqueio } = props;
  return (
    <Aviso
      {...props}
      preview="O pagamento da sua assinatura foi recusado"
      titulo="Pagamento recusado"
      intro={`O pagamento da assinatura de ${barbearia} (plano ${plano}, ${preco} por mês) foi recusado. Atualize o cartão${ateADataDoBloqueio(dataDoBloqueio)} para não ter o acesso bloqueado.`}
      botao="Atualizar cartão"
      aviso="Até essa data você continua usando o Navalhado normalmente. Se o pagamento for aprovado, não precisa fazer mais nada."
    />
  );
}

export function PagamentoRecusadoTerceiroDiaEmail(props: PagamentoRecusadoProps) {
  const { barbearia, dataDoBloqueio } = props;
  return (
    <Aviso
      {...props}
      preview="Faltam 2 dias para o bloqueio do acesso"
      titulo="Faltam 2 dias"
      intro={`O pagamento da assinatura de ${barbearia} continua pendente. Atualize o cartão${ateADataDoBloqueio(dataDoBloqueio)} para não ter o acesso bloqueado.`}
      botao="Atualizar cartão"
      aviso="Depois dessa data o painel, o agendamento online e os lembretes por WhatsApp da barbearia ficam parados. Seus dados continuam guardados."
    />
  );
}

export function PagamentoRecusadoQuartoDiaEmail(props: PagamentoRecusadoProps) {
  const { barbearia, dataDoBloqueio } = props;
  return (
    <Aviso
      {...props}
      preview="Amanhã o acesso será bloqueado"
      titulo="O acesso será bloqueado amanhã"
      intro={`O pagamento da assinatura de ${barbearia} ainda não foi aprovado. Atualize o cartão hoje para não perder o acesso amanhã${dataDoBloqueio ? ` (${dataDoBloqueio})` : ""}.`}
      botao="Atualizar cartão"
      aviso="Depois disso o painel, o agendamento online e os lembretes por WhatsApp da barbearia ficam parados. Seus dados continuam guardados."
    />
  );
}

// ---- Bloqueio efetivado -----------------------------------------------------------------------------

export interface BloqueioProps extends AvisoProps {
  /** blocked_reason da assinatura; sem motivo conhecido, o texto e o generico. */
  motivo: string | null;
}

function textoDoBloqueio(motivo: string | null, barbearia: string): { intro: string; botao: string } {
  switch (motivo) {
    case "trial_expired":
      return {
        intro: `O período de teste de ${barbearia} terminou e o acesso ao Navalhado foi bloqueado. Assine um plano para voltar a usar.`,
        botao: "Assinar agora",
      };
    case "payment_failed":
      return {
        intro: `O pagamento da assinatura de ${barbearia} não foi aprovado em 5 dias, e o acesso ao Navalhado foi bloqueado. Atualize o cartão para voltar a usar.`,
        botao: "Atualizar cartão",
      };
    case "canceled":
      return {
        intro: `A assinatura de ${barbearia} foi cancelada e o período pago terminou, então o acesso ao Navalhado foi bloqueado. Assine de novo para voltar a usar.`,
        botao: "Assinar de novo",
      };
    case "courtesy_expired":
      return {
        intro: `A cortesia de ${barbearia} terminou e o acesso ao Navalhado foi bloqueado. Assine um plano para voltar a usar.`,
        botao: "Assinar agora",
      };
    case "refunded":
      return {
        intro: `Um pagamento da assinatura de ${barbearia} foi estornado, e o acesso ao Navalhado foi bloqueado. Assine de novo para voltar a usar.`,
        botao: "Assinar de novo",
      };
    case "charged_back":
      return {
        intro: `Um pagamento da assinatura de ${barbearia} foi contestado, e o acesso ao Navalhado foi bloqueado. Assine de novo para voltar a usar.`,
        botao: "Assinar de novo",
      };
    default:
      return {
        intro: `O acesso de ${barbearia} ao Navalhado foi bloqueado. Entre no Navalhado para ver como regularizar.`,
        botao: "Voltar ao Navalhado",
      };
  }
}

export function AcessoBloqueadoEmail(props: BloqueioProps) {
  const { intro, botao } = textoDoBloqueio(props.motivo, props.barbearia);
  return (
    <Aviso
      {...props}
      preview="O acesso da sua barbearia ao Navalhado foi bloqueado"
      titulo="Acesso bloqueado"
      intro={intro}
      botao={botao}
      aviso="Os dados da sua barbearia continuam guardados: quando o acesso voltar, tudo estará como você deixou. Enquanto estiver bloqueado, o agendamento online e os lembretes por WhatsApp ficam parados."
    />
  );
}

// ---- Dados para o preview (npm run email) -------------------------------------------------------------

const previewBase: AvisoProps = {
  logoUrl: "/static/logo.png",
  url: "https://dev.navalhado.com.br/configuracoes",
  barbearia: "Barbearia do Zé",
  plano: "Máquina",
  preco: "R$ 89,90",
};

PagamentoRecusadoEmail.PreviewProps = { ...previewBase, dataDoBloqueio: "06/06" } satisfies PagamentoRecusadoProps;
PagamentoRecusadoTerceiroDiaEmail.PreviewProps = { ...previewBase, dataDoBloqueio: "06/06" } satisfies PagamentoRecusadoProps;
PagamentoRecusadoQuartoDiaEmail.PreviewProps = { ...previewBase, dataDoBloqueio: "06/06" } satisfies PagamentoRecusadoProps;
FimDoTesteEmail.PreviewProps = { ...previewBase, fimDoTeste: "10/06", assinaturaAutorizada: false } satisfies FimDoTesteProps;
AcessoBloqueadoEmail.PreviewProps = { ...previewBase, motivo: "payment_failed" } satisfies BloqueioProps;

export default PagamentoRecusadoEmail;
