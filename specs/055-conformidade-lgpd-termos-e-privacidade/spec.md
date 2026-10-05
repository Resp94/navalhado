# Especificação Técnica: o sistema cumpre o que os novos Termos de Uso e a nova Política de Privacidade prometem

Triagem: `needs-triage`

## Problem Statement

Em 2026-10-05 escrevemos as minutas novas dos Termos de Uso e da Política de Privacidade:

- `docs/legal/termos-de-uso.md`
- `docs/legal/politica-de-privacidade.md`
- `docs/legal/diagnostico-e-pendencias.md`

Elas substituem o rascunho técnico do ticket 16 da spec 052 (`src/modules/termos/textos.ts`, versão 2026-10-02). Para cumprir a LGPD, o Marco Civil da Internet e o CDC, as minutas prometem coisas que o sistema ainda não faz. Publicar o texto antes de o sistema cumprir essas promessas transforma cada uma delas em uma declaração falsa, assinada pelo Gerente no aceite.

**1. Não há registro de acesso.** O Marco Civil (Lei 12.965/2014, art. 15) obriga o provedor de aplicação a guardar, por 6 meses e em sigilo, os registros de acesso: data, hora e endereço IP de cada uso. A coluna `audit_logs.ip_address` existe (migration 027), mas nenhum INSERT a preenche. Os logs do Supabase duram poucos dias, conforme o plano. A cláusula 13.4 dos Termos e a seção 8 da Política dizem que guardamos esses registros.

**2. O cliente da barbearia não consegue parar de receber o lembrete de retorno.** O lembrete de retorno (`return_reminder`, cron diário `/process-return-reminders`) é promocional ("Que tal renovar o visual?"):

- vai para toda instância `connected` (`whatsapp-integration/index.ts`, por volta da linha 2530);
- não tem chave liga/desliga por barbearia, ao contrário de `send_confirmation`, `send_reminders`, `send_cancellation` e boas-vindas;
- não oferece descadastro ao cliente.

Marketing direto com base no legítimo interesse exige o direito de oposição (LGPD, art. 18, § 2º). O envio repetido, sem saída, também aumenta o risco de o WhatsApp banir o número da barbearia, porque a integração da Uazapi não é oficial.

**3. O cliente informa nome e telefone sem ver aviso de privacidade.** Desde a spec 026, o Canal do Cliente não mostra termo nem privacidade. O ticket 16 da 052 registrou isso como lacuna (o `LegalModal` saiu). A LGPD (art. 9º) pede transparência no momento da coleta.

**4. Os textos não têm endereço público.** Os termos só abrem num modal do Login, do Cadastro e da tela de aceite. O Decreto 7.962/2013 (art. 4º, IV) pede que o contrato fique disponível para ser salvo e impresso, e o Canal do Cliente precisa de um link estável para a Política. A rota `/:slug` captura qualquer caminho de um segmento, e nenhum slug é reservado: uma barbearia com slug `termos` ou `privacidade` tomaria o endereço, e uma rota estática esconderia a página dela.

**5. Nada é eliminado.**

- Não existe rotina de expurgo de barbearias canceladas ou bloqueadas.
- Não existe expurgo das sessões anônimas vencidas do Canal do Cliente (`public_customer_sessions` e os usuários anônimos do Supabase Auth).
- Não existe fluxo para excluir uma barbearia a pedido; o texto atual diz "a pedido, pelo suporte", sem um caminho.

A Política nova promete um prazo de guarda depois do fim do contrato e a eliminação a pedido (LGPD, arts. 15, 16 e 18, VI).

**6. A prova do aceite é fraca.**

- `terms_acceptances` guarda só o usuário, a versão e a data, sem IP nem user agent.
- Apaga o aceite junto do usuário (`on delete cascade`).
- O texto de cada versão só existe no histórico do Git, e nada impede mudar o texto sem mudar a versão (limitação do ticket 16).

**7. O arrependimento não tem como ser cumprido.** A cláusula 11.2 dos Termos promete devolver a primeira cobrança se o cancelamento vier em até 7 dias. O cancelamento de hoje (ticket 12 da 052) para a recorrência e não reembolsa nada. Essa cláusula depende de decisão do advogado (diagnóstico, seção 3, item 2).

**8. Pendências menores:**

- As fontes vêm do Google Fonts, uma transferência internacional de IP sem necessidade.
- O exemplo do campo de observações do cliente ("…ou restrições…", `Clientes.tsx:729`) induz a registrar dado de saúde.
- O Gerente não vê no painel qual versão aceitou nem relê os textos.
- O Proprietário, que lê todas as barbearias, entra sem MFA.

## Solution

O sistema passa a cumprir cada promessa das minutas antes de o texto novo ir para `textos.ts`, e só então o texto é publicado, com aviso prévio aos Gerentes.

- **Registro de acesso:**
  - Cada entrada no painel (Gerente, Barbeiro, Proprietário) e cada sessão aberta no Canal do Cliente gravam data, hora, IP e o identificador de quem entrou numa tabela própria.
  - Quem grava é o servidor, que lê o IP do cabeçalho da requisição; o navegador não informa o IP.
  - Ninguém lê a tabela pelo navegador.
  - Uma rotina apaga o que passou de 6 meses.
- **Lembrete de retorno sob controle:**
  - A barbearia ganha a chave "Lembrete de retorno" nos ajustes do WhatsApp.
  - O cliente que responde "SAIR" deixa de receber mensagens promocionais daquela barbearia e recebe uma confirmação.
  - O Gerente vê e desfaz isso na ficha do cliente.
  - O modelo do lembrete de retorno ganha o rodapé "Para não receber mais lembretes como este, responda SAIR."
- **Aviso no Canal do Cliente:** o formulário de nome e telefone ganha uma linha que explica para que os dados servem, com um link para a Política de Privacidade.
- **Páginas públicas:**
  - `/termos` e `/privacidade` mostram os textos vigentes, com a versão, e podem ser impressas.
  - Esses slugs, e os das rotas fixas que já existem, passam a ser reservados.
- **Exclusão de barbearia:**
  - Uma ferramenta do Proprietário exclui uma barbearia a pedido: apaga os dados operacionais e as contas e guarda só o que a lei manda (cobranças, por 5 anos).
  - Uma rotina diária aplica a mesma exclusão às barbearias canceladas ou bloqueadas há mais do que o prazo de guarda.
  - Outra rotina apaga as sessões anônimas vencidas.
- **Prova do aceite:**
  - O aceite passa a guardar IP e user agent.
  - O aceite sobrevive à exclusão do usuário (com o e-mail congelado).
  - Um teste falha se o texto mudar sem a versão mudar.
- **Arrependimento**, se o advogado mantiver a cláusula: o cancelamento em até 7 dias depois da primeira cobrança paga devolve o valor pelo Mercado Pago.
- **Higiene:**
  - fontes servidas pelo próprio site;
  - exemplo do campo de observações sem "restrições";
  - em Configurações, a versão aceita, a data do aceite e os links dos textos;
  - MFA para o Proprietário.
- **Publicação:** depois da revisão do advogado e dos tickets que cumprem as promessas, as minutas viram o `textos.ts` com versão nova. Os Gerentes recebem o aviso por e-mail 15 dias antes da vigência e aceitam na entrada.

## User Stories

1. Como dono do Navalhado, quero guardar os registros de acesso por 6 meses, para cumprir o Marco Civil e responder a uma ordem judicial.
2. Como dono do Navalhado, quero que os registros de acesso sejam gravados pelo servidor, com o IP lido da requisição, para o navegador não conseguir falsificá-los.
3. Como Gerente, quero que ninguém de outra barbearia, nem eu, consiga ler os registros de acesso pelo navegador, porque eles são sigilosos.
4. Como dono do Navalhado, quero que os registros com mais de 6 meses sejam apagados sozinhos, para não guardar dado além do necessário.
5. Como cliente de uma barbearia, quero responder "SAIR" e parar de receber o lembrete de retorno, para não receber propaganda que não quero.
6. Como cliente que respondeu "SAIR", quero continuar recebendo a confirmação e o lembrete do horário que eu marquei, porque eles fazem parte do serviço que pedi.
7. Como cliente, quero receber uma confirmação de que o pedido de "SAIR" foi registrado.
8. Como Gerente, quero ver na ficha do cliente que ele pediu para não receber lembretes de retorno, e poder desfazer isso a pedido dele.
9. Como Gerente, quero desligar o lembrete de retorno da minha barbearia, como já desligo a confirmação e o lembrete.
10. Como cliente, quero saber para que a barbearia usa meu nome e meu telefone antes de enviá-los, com um link para a Política de Privacidade.
11. Como Gerente ou cliente, quero abrir os Termos e a Política num endereço público e imprimi-los.
12. Como barbearia, quero que nenhum endereço público do Navalhado tome o meu slug, e que meu slug não esconda uma página do sistema.
13. Como Gerente que cancelou, quero pedir a exclusão dos dados da minha barbearia e ter o pedido cumprido.
14. Como Proprietário, quero excluir uma barbearia a pedido numa ferramenta, sem SQL à mão, mantendo as cobranças que a lei manda guardar.
15. Como dono do Navalhado, quero que a barbearia cancelada ou bloqueada há mais do que o prazo de guarda seja excluída sozinha.
16. Como dono do Navalhado, quero que as sessões anônimas vencidas do Canal do Cliente sejam apagadas.
17. Como dono do Navalhado, quero que o aceite guarde IP e user agent e sobreviva à exclusão do usuário, para provar o contrato.
18. Como desenvolvedor, quero que um teste falhe se alguém mudar o texto dos termos sem mudar a versão.
19. Como Gerente, quero o valor da primeira cobrança de volta se eu cancelar em até 7 dias depois dela.
20. Como visitante, não quero que o meu IP vá para o Google só para carregar uma fonte.
21. Como Gerente, quero que o campo de observações não me induza a anotar dado de saúde do cliente.
22. Como Gerente, quero ver em Configurações qual versão dos termos aceitei e quando, e reler os textos.
23. Como Proprietário, quero entrar com um segundo fator, porque o meu acesso abre todas as barbearias.
24. Como Gerente já cadastrado, quero ser avisado por e-mail 15 dias antes de os termos novos valerem.

## Implementation Decisions

- **Ordem.** Os tickets 01 a 13 deixam o sistema pronto para o texto. O 14 publica o texto e depende da revisão do advogado e dos tickets que o texto descreve (01, 02, 03, 04, 05 e 07; o 09 só se a cláusula do arrependimento ficar).
- **Registro de acesso (01):**
  - Tabela `private.access_logs` (ou `public` sem nenhum privilégio para `anon` e `authenticated`), com:
    - `occurred_at`;
    - `ip` (inet);
    - `auth_user_id`;
    - `kind`: `painel` ou `canal_cliente`;
    - `tenant_id`, quando houver.
  - Gravação no painel: uma RPC `security definer`, chamada pelo front quando a sessão começa (login e retomada da sessão). O IP é lido de `current_setting('request.headers')`: primeiro `cf-connecting-ip`, depois o primeiro item de `x-forwarded-for`. O front não passa IP.
  - Gravação no Canal do Cliente: a função `public-customer-session`, que já lê o IP para o Turnstile, grava com o service role.
  - Expurgo: `pg_cron` diário apaga o que tem mais de 6 meses.
  - O que não entra: a porta lógica de origem (o Cloudflare não a repassa) e o user agent. Os dois ficam para o advogado decidir.
- **Opt-out (02):**
  - Coluna nova `customers.marketing_opt_out_at` (nula = recebe).
  - O que bloqueia: só os envios promocionais, isto é, o lembrete de retorno e as boas-vindas. Confirmação, reagendamento, cancelamento, lembrete do horário e mensagem manual do Gerente continuam, porque o cliente os pediu ou respondem a ele.
  - A palavra é reconhecida pela mensagem inteira normalizada (`SAIR`, `PARAR`, `STOP`), e não por "contém", para "vou sair mais cedo" não descadastrar ninguém.
  - O descadastro tem precedência sobre a resposta automática por palavra-chave.
  - A resposta de confirmação é um texto fixo.
- **Chave do lembrete de retorno (03):**
  - Coluna `send_return_reminders boolean not null default true` na tabela de instâncias.
  - O padrão `true` preserva o comportamento de hoje.
  - O cron pula a instância desligada.
- **Aviso no Canal do Cliente (04):** texto curto, com o link para `/privacidade` (do ticket 05). Sem caixa de "aceito": a base é a execução do pedido de agendamento (art. 7º, V), não o consentimento. Até o 05 existir, o link abre o modal de termos que já existe.
- **Páginas públicas (05):**
  - `/termos` e `/privacidade` são rotas estáticas, declaradas antes de `/:slug`.
  - Lista de slugs reservados, conferida na criação e na edição do slug, no banco: `termos`, `privacidade`, `signup`, `reset-password`, `onboarding`, `agenda`, `comandas`, `dashboard`, `financeiro`, `relatorios`, `profissionais`, `servicos`, `produtos`, `whatsapp`, `clientes`, `configuracoes`, `admin`, `cliente`, `c`, `minha-agenda`, `minhas-comissoes`.
  - O ticket confere, só com leitura, se algum tenant do DEV ou da PROD já usa um desses slugs. Se usar, para e volta ao usuário.
- **Exclusão de barbearia (06):**
  - Uma função `private`, chamada por uma ação nova das Ferramentas do Proprietário (`private.assert_saas_admin()`, motivo obrigatório, `audit_logs`), com confirmação digitando o nome da barbearia.
  - O que apaga: clientes, agenda, comandas, financeiro, profissionais, serviços, produtos, fornecedores, WhatsApp (com a exclusão da instância na Uazapi, pela rota do ticket 13 da 052) e as contas `auth.users` de Gerentes e Barbeiros.
  - O que fica: a linha do tenant anonimizada (nome "Barbearia excluída", contatos e endereço nulos), `tenant_subscriptions`, `billing_charges` e `billing_events` por 5 anos, e os aceites (do ticket 08).
  - A barbearia com assinatura viva no Mercado Pago não pode ser excluída: cancele primeiro.
- **Expurgo automático (07):**
  - O prazo de guarda depois do fim do contrato é **decisão pendente** (sugestão: 12 meses). Fica numa constante do banco.
  - A rotina diária escolhe as barbearias cujo Estado de Acesso está `blocked` há mais do que o prazo e chama a função do 06.
  - A mesma rotina, ou uma irmã, apaga `public_customer_sessions` vencidas há mais de 30 dias e os usuários anônimos órfãos.
  - O cron das cobranças fica de fora: as cobranças guardadas por 5 anos têm expurgo próprio, que sai desta spec.
- **Prova do aceite (08):**
  - `terms_acceptances` ganha `ip inet` e `user_agent text`, lidos dos cabeçalhos em `accept_terms` e no gatilho do cadastro.
  - A chave estrangeira passa a `on delete set null`, com `email` congelado no aceite.
  - Um teste do Vitest guarda o hash de cada versão publicada dos textos e falha se o texto da versão atual mudar.
- **Arrependimento (09):**
  - **Bloqueado pela decisão do advogado.**
  - Se ficar: o cancelamento pela tela Assinatura, em até 7 dias depois da primeira cobrança `approved` da barbearia, pede o reembolso dessa cobrança ao Mercado Pago (API de reembolso) e encerra o acesso na hora (o Estado de Acesso passa a `blocked`, com motivo próprio).
  - Só vale para a primeira cobrança da barbearia; quem assina de novo não ganha outro prazo.
- **Fontes (10):** a fonte Outfit é servida de `public/fonts`, e a CSP perde `fonts.googleapis.com` e `fonts.gstatic.com`.
- **Placeholder (11):** só o texto do exemplo muda.
- **Configurações (12):** uma seção "Termos e privacidade" mostra a versão aceita, a data do aceite e os dois links (para as páginas do 05).
- **MFA do Proprietário (13):**
  - TOTP do Supabase Auth.
  - O `AuthGuard` do papel `proprietario` exige `aal2`.
  - As RPCs de `private.assert_saas_admin()` passam a conferir o `aal` do JWT, para a guarda não ficar só na tela.
- **Publicação (14):**
  - As minutas revisadas entram em `textos.ts` (a estrutura de seções que já existe) e `VERSAO_ATUAL_DOS_TERMOS` vira a data de vigência.
  - O aviso aos Gerentes ativos sai por e-mail (Resend, como os avisos de cobrança) 15 dias antes.
  - O banco recusa versão futura, então o front com a versão nova só vai ao ar na data de vigência.
- **Ambientes:** tudo vai primeiro para o DEV (`selvxobcjbkligxighlp`), pelo MCP. A PROD depende da promoção da spec 052, que ainda não tem spec: os tickets 06, 08, 09 e 14 usam tabelas da 052.

## Testing Decisions

- **Um bom teste** prova o que o titular, o Gerente ou a autoridade veem: o registro gravado com o IP certo, a mensagem que não sai, o dado que sumiu e o que ficou. Ele não prova como a consulta foi montada.
- **pgTAP** (próximo número livre: 81), rodado pelo MCP em `begin; ... rollback;`:
  - **01:** a gravação com IP vindo de `request.headers`; nenhum privilégio de leitura para `anon` e `authenticated`; o expurgo apaga só o que passou de 6 meses.
  - **02 e 03:** o cliente com `marketing_opt_out_at` sai de `get_pending_return_reminders`; a instância com `send_return_reminders = false` também.
  - **05:** os slugs reservados são recusados na criação e na edição.
  - **06:** a guarda recusa Gerente, Barbeiro, anônimo e Gerente com `tenant_id` nulo; o que some e o que fica.
  - **07:** só a barbearia além do prazo é excluída.
  - **08:** o aceite sobrevive à exclusão do usuário; o IP é gravado.
- **Vitest:**
  - **02:** o reconhecimento de "SAIR" (mensagem inteira, normalizada) e a precedência sobre a palavra-chave da resposta automática; a função pura fica testável fora da edge function.
  - **04:** o aviso e o link no formulário de identificação.
  - **05:** as rotas `/termos` e `/privacidade`.
  - **08:** o hash dos textos.
  - **12:** a seção de Configurações.
  - **13:** o `AuthGuard` com `aal1` e com `aal2`.
- **Teste no DEV que dispara WhatsApp real:** instância conectada envia mensagem de verdade (ver memória do projeto). Os testes de 02 e 03 que passam pelo cron usam cliente e agendamento de teste montados para não chegar a número real, ou ficam no pgTAP e no Vitest.

## Out of Scope

- A redação final dos textos: é do advogado. Esta spec só leva o texto revisado ao código (ticket 14).
- O expurgo das cobranças depois de 5 anos.
- Uma página de "pedidos do titular" com autoatendimento. O canal continua sendo o e-mail privacidade@navalhado.com.br.
- Trocar a Uazapi pela API oficial do WhatsApp.
- Banner de cookies: o sistema não usa cookies de análise nem de publicidade (Política, seção 12).
- A promoção para a PROD (depende da promoção da 052).

## Further Notes

- Ver `docs/legal/diagnostico-e-pendencias.md`, seção 2. Esta spec é aquela tabela quebrada em tickets.
- Decisões pendentes que travam tickets:
  - o prazo de guarda (07);
  - manter ou não o arrependimento (09);
  - a porta lógica e o user agent no registro de acesso (01; o ticket entrega sem eles).
- Os e-mails suporte@ e privacidade@navalhado.com.br precisam existir antes do 14.
- Os tickets moram em `.scratch/conformidade-lgpd/issues/`.
