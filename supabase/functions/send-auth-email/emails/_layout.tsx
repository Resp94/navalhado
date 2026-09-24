// Spec 049: layout compartilhado dos e-mails de Auth (confirmacao e
// redefinicao de senha). Visual aprovado nos protototipos, inspirado no
// template de confirmacao do Slack do repositorio de demos do React Email.
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email";
import type { ReactNode } from "react";

const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        "brand-solid": "#B85900",
        "brand-lightest": "#FFF1E6",
        fg: "#2D231E",
        "fg-2": "#70625B",
        muted: "#A8998F",
      },
      fontFamily: {
        sans: ["Helvetica", "Arial", "sans-serif"],
      },
    },
  },
};

function Marca({ logoUrl, tamanho }: { logoUrl: string; tamanho: number }) {
  return (
    <Row align="left" style={{ width: "auto", margin: 0 }}>
      <Column className="pr-2 align-middle">
        <Img src={logoUrl} alt="" width={tamanho} height={tamanho} />
      </Column>
      <Column className="align-middle">
        <Text
          className="m-0 font-bold text-brand-solid tracking-[1px]"
          style={{ fontSize: Math.round(tamanho * 0.5) }}
        >
          NAVALHADO
        </Text>
      </Column>
    </Row>
  );
}

export interface NavalhadoEmailLayoutProps {
  logoUrl: string;
  preview: string;
  titulo: string;
  intro: string;
  acao: { rotulo: string; url: string };
  aviso: string;
}

export function NavalhadoEmailLayout({
  logoUrl,
  preview,
  titulo,
  intro,
  acao,
  aviso,
}: NavalhadoEmailLayoutProps): ReactNode {
  return (
    <Html lang="pt-BR">
      <Head />
      <Tailwind config={tailwindConfig}>
        <Body className="bg-white font-sans mx-auto my-0">
          <Preview>{preview}</Preview>
          <Container className="mx-auto my-0 py-0 px-5 max-w-[600px]">
            <Section className="mt-8">
              <Marca logoUrl={logoUrl} tamanho={40} />
            </Section>

            <Heading className="text-fg text-[36px] font-bold my-[30px] mx-0 p-0 leading-[42px]">
              {titulo}
            </Heading>
            <Text className="text-fg text-[20px] leading-[28px] mb-[30px]">{intro}</Text>

            <Section className="bg-brand-lightest rounded-[8px] mb-[30px] py-10 px-[10px] text-center">
              <Button
                href={acao.url}
                className="box-border inline-block rounded-[8px] bg-brand-solid px-8 py-4 text-[18px] font-bold text-white no-underline"
              >
                {acao.rotulo}
              </Button>
            </Section>

            <Text className="text-fg text-[14px] leading-[24px]">{aviso}</Text>
            <Text className="text-fg-2 text-[14px] leading-[24px]">
              Se o botão não funcionar, copie e cole este endereço no navegador:{" "}
              <Link href={acao.url} className="text-brand-solid underline break-all">
                {acao.url}
              </Link>
            </Text>

            <Section className="mt-[40px]">
              <Row className="mb-8">
                <Column>
                  <Marca logoUrl={logoUrl} tamanho={28} />
                </Column>
              </Row>
            </Section>

            <Section>
              <Text className="text-[12px] leading-[15px] text-left mb-[50px] text-muted">
                Você recebeu este e-mail porque há uma conta Navalhado com este endereço.
                <br />
                <br />© {new Date().getFullYear()} Navalhado. Todos os direitos reservados.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
