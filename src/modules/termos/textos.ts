import type { DocumentoLegal, TextoLegal } from './types';

/**
 * A versão atual dos textos: a data em que foram publicados (AAAA-MM-DD). É ela que o Gerente aceita e que o banco guarda
 * (`terms_acceptances.version`); mudar o texto é mudar esta data, e todo Gerente passa a ver a tela de aceite de novo.
 *
 * A versão é uma data que existe e que não é posterior a hoje (o banco recusa o aceite de uma versão que ainda não chegou).
 *
 * RASCUNHO TÉCNICO (spec 052, ticket 16): escrito a partir do que o sistema faz, e não revisado por advogado. Precisa de revisão
 * jurídica antes do lançamento em prod; o que o advogado precisa decidir está no doc do ticket 16 ("O que o advogado precisa rever").
 */
export const VERSAO_ATUAL_DOS_TERMOS = '2026-10-02';

// O preço de cada plano mora no banco (tabela `plans`) e aparece no cadastro e na tela Assinatura: o texto remete a eles e não
// escreve valores, para um reajuste do catálogo não deixar o contrato dizendo um preço que não vale mais.
export const TERMOS_DE_USO: TextoLegal = {
  titulo: 'Termos de Uso',
  secoes: [
    {
      titulo: '1. Aceite e quem pode aceitar',
      paragrafos: [
        'Estes Termos de Uso valem para o uso do Navalhado pela barbearia que contrata a plataforma e por quem a administra e a usa. Ao criar a conta, ou ao entrar depois de uma atualização destes termos, o Gerente declara que leu e aceita os Termos de Uso e a Política de Privacidade e que tem poderes para contratar em nome da barbearia. Os profissionais da barbearia usam o Navalhado nos termos contratados por ela.',
        'O Navalhado registra o aceite do Gerente com a versão dos textos e a data.',
      ],
    },
    {
      titulo: '2. Uso da conta e responsabilidades',
      paragrafos: [
        'Gestores e profissionais são responsáveis por manter em sigilo as suas credenciais de acesso.',
        'Quem usa a conta responde por cumprir as leis e regulamentações aplicáveis ao uso do Navalhado e aos serviços da barbearia.',
        'O uso da conta para disparos de mensagens não autorizados ou para práticas ilegais permite ao Navalhado bloquear o acesso da barbearia.',
      ],
    },
    {
      titulo: '3. Preço e renovação mensal automática',
      paragrafos: [
        'O preço mensal e o limite de profissionais de cada plano aparecem na tela de cadastro e na tela Assinatura do painel.',
        'A assinatura é mensal e se renova sozinha a cada mês, até ser cancelada.',
        'A cobrança é feita pelo Mercado Pago, no cartão de crédito, no cartão de débito ou no saldo da conta que você informar na página de pagamento dele. O Navalhado não recebe o número do cartão: guarda só a bandeira e os quatro últimos dígitos, para mostrar na tela Assinatura.',
      ],
    },
    {
      titulo: '4. Teste de 15 dias',
      paragrafos: [
        'Toda barbearia nova tem 15 dias de teste, contados do cadastro, sem cartão e com o WhatsApp liberado.',
        'Nos últimos 3 dias do teste o painel mostra um aviso e o Navalhado manda um e-mail. Quem assina durante o teste só é cobrado no fim dele.',
        'Ao fim do teste, sem assinatura, o acesso ao painel é bloqueado até a assinatura ser paga.',
      ],
    },
    {
      titulo: '5. Cancelamento',
      paragrafos: [
        'Você cancela a assinatura quando quiser, pela tela Assinatura do painel ou direto no Mercado Pago.',
        'A cobrança recorrente para na hora e nada é reembolsado. O acesso continua até o fim do período já pago e, depois dele, o painel é bloqueado.',
        'No período de teste, cancelar só impede a primeira cobrança: o teste segue até o fim.',
      ],
    },
    {
      titulo: '6. Subida de plano',
      paragrafos: [
        'Subir para um plano mais caro vale na hora. O Navalhado cobra a diferença de preço entre os planos, proporcional aos dias que faltam no período já pago, calculada e mostrada antes de você confirmar. A próxima mensalidade já vem no valor do plano novo.',
        'Durante o teste, trocar de plano não cobra nada.',
      ],
    },
    {
      titulo: '7. Descida de plano',
      paragrafos: [
        'Descer para um plano mais barato não cobra nem reembolsa nada: o plano menor passa a valer na próxima cobrança, e você pode desfazer a descida antes disso.',
        'Só é possível descer se os profissionais ativos couberem no limite do plano menor.',
      ],
    },
    {
      titulo: '8. Pagamento recusado e bloqueio do acesso no quinto dia',
      paragrafos: [
        'Se uma mensalidade for recusada, o painel continua liberado, com um aviso na tela, até o quinto dia depois da primeira recusa. Nesse prazo o Navalhado avisa por e-mail no dia da recusa, no terceiro e no quarto dia, e você pode atualizar o cartão na tela Assinatura.',
        'No quinto dia sem pagamento aprovado o acesso é bloqueado, e o Navalhado avisa por e-mail. O estorno ou a contestação de um pagamento bloqueiam o acesso na hora.',
        'Com o acesso bloqueado, o painel mostra só a tela de bloqueio, os clientes da barbearia não conseguem marcar nem remarcar horários pelo link, mas ainda cancelam os que já têm, e nenhuma mensagem é enviada pelo WhatsApp. O acesso volta quando o pagamento é aprovado.',
      ],
    },
    {
      titulo: '9. Guarda dos dados e exportação',
      paragrafos: [
        'Os dados da barbearia (clientes, agendamentos, comandas e o restante do que você cadastrou) ficam guardados sem prazo, também depois de cancelar a assinatura ou de o acesso ser bloqueado.',
        'Você baixa os dados da barbearia quando quiser, até com o acesso bloqueado, pelo botão "Exportar dados" da tela Assinatura e da tela de bloqueio. O Navalhado gera arquivos CSV de clientes, agendamentos e comandas.',
      ],
    },
    {
      titulo: '10. Exclusão do WhatsApp no sétimo dia de bloqueio',
      paragrafos: [
        'Quando a barbearia completa 7 dias com o acesso bloqueado, o Navalhado exclui a conexão do WhatsApp dela no servidor de mensagens (a Instância WhatsApp). Os modelos de mensagem e os ajustes do WhatsApp voltam ao padrão; o histórico de envios e os demais dados ficam.',
        'Quem paga antes disso não perde nada, e um pagamento em análise adia a exclusão. Quem volta depois conecta o WhatsApp de novo pelo fluxo normal, como no primeiro uso.',
      ],
    },
    {
      titulo: '11. Serviços de terceiros',
      paragrafos: [
        'O WhatsApp, o e-mail e o pagamento dependem de serviços de terceiros, como o Mercado Pago. O Navalhado trabalha para que funcionem bem, mas não controla a disponibilidade deles.',
      ],
    },
    {
      titulo: '12. Mudança destes termos',
      paragrafos: [
        'Quando estes termos mudam, o texto ganha uma versão nova, com a data de publicação. O Gerente precisa aceitá-la para continuar entrando no painel, e as versões aceitas ficam registradas.',
      ],
    },
  ],
};

export const POLITICA_DE_PRIVACIDADE: TextoLegal = {
  titulo: 'Política de Privacidade (LGPD)',
  secoes: [
    {
      titulo: '1. Dados que tratamos',
      paragrafos: [
        'Da barbearia e de quem a administra: nome da barbearia, e-mail, telefone e, de cada usuário, nome e e-mail de acesso.',
        'Dos clientes da barbearia, que a própria barbearia cadastra ou que se cadastram pelo link de agendamento: nome, telefone, e-mail e, quando a barbearia informa, CPF, data de nascimento e anotações, além do histórico de agendamentos e de comandas.',
        'Da cobrança: o plano, a situação da assinatura, o histórico de cobranças e a bandeira e os quatro últimos dígitos do cartão. O número completo do cartão vai direto para o Mercado Pago e nunca passa pelo Navalhado.',
      ],
    },
    {
      titulo: '2. Para que usamos os dados',
      paragrafos: [
        'Para operar a agenda e o atendimento da barbearia, enviar lembretes e confirmações pelo WhatsApp, cobrar a assinatura e avisar o Gerente por e-mail sobre ela (fim do teste, pagamento recusado e bloqueio).',
        'Tratamos só os dados necessários para essas finalidades.',
      ],
    },
    {
      titulo: '3. Base legal (LGPD - Lei nº 13.709/2018)',
      paragrafos: [
        'O tratamento de dados pessoais se fundamenta no Artigo 7º, Inciso V da LGPD (execução de contrato e procedimentos preliminares a pedido do titular) e no legítimo interesse para a gestão do fluxo operacional da barbearia.',
      ],
    },
    {
      titulo: '4. Guarda dos dados depois do cancelamento',
      paragrafos: [
        'Quando a assinatura é cancelada ou o acesso é bloqueado, os dados da barbearia continuam guardados, sem prazo.',
        'O Gerente baixa os dados pela tela do painel, no botão "Exportar dados" (que também está na tela de bloqueio). A exclusão dos dados é feita a pedido, pelo suporte.',
      ],
    },
    {
      titulo: '5. Direitos do titular (Art. 18 da LGPD)',
      paragrafos: [
        'O titular pode pedir a qualquer momento a confirmação do tratamento, o acesso aos seus dados, a correção de informações incompletas ou a anonimização/eliminação dos seus registros, pelo contato direto com o estabelecimento responsável ou com o suporte.',
      ],
    },
    {
      titulo: '6. Com quem compartilhamos',
      paragrafos: [
        'Compartilhamos dados só com quem opera partes do serviço: o Mercado Pago (cobrança), o provedor de WhatsApp (mensagens), o provedor de e-mail (avisos) e a infraestrutura de hospedagem e de banco de dados.',
      ],
    },
    {
      titulo: '7. Segurança',
      paragrafos: [
        'Os dados trafegam por conexões criptografadas (HTTPS) e ficam em banco de dados com isolamento por barbearia (Row Level Security): cada barbearia só enxerga os próprios dados.',
      ],
    },
  ],
};

export function textoDoDocumento(documento: DocumentoLegal): TextoLegal {
  return documento === 'termos' ? TERMOS_DE_USO : POLITICA_DE_PRIVACIDADE;
}
