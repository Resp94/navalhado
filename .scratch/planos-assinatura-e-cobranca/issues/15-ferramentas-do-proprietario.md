# 15: Ferramentas do Proprietário

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** em Admin > Tenants, o Proprietário vê a assinatura de cada barbearia e resolve os casos de suporte sem abrir o banco.

- Funções do banco só para o Proprietário:
  - **estender o teste** até uma data
  - **cortesia:** marcar e desmarcar, com data de fim opcional; sem cobrança e sem bloqueio enquanto vale
  - **desbloquear** até uma data, com o motivo registrado
  - **ler os detalhes:** plano, situação, datas, profissionais ativos, ids no Mercado Pago e histórico de cobranças
  - **avisos por e-mail que falharam:** os de `billing_notices` com `status = 'failed'` (esgotaram as tentativas, ou o Resend recusou), com o motivo em `detail`, para o Proprietário perceber uma chave do Resend vencida ou um domínio sem verificação antes de o cliente reclamar (ticket 08)
- Desbloquear e dar cortesia não criam nem alteram nada no Mercado Pago.
- A tela Admin > Tenants ganha a coluna de situação e uma visão de detalhe com essas ações, cada uma com confirmação.
- O `CONTEXT.md` ganha o termo Cortesia.

**Blocked by:** 03 (Período de teste, Estado de Acesso e bloqueio do painel), 05 (Assinar pelo Mercado Pago, 05a)

**Status:** done

- [x] pgTAP: cada função funciona para o Proprietário e é recusada para Gerente, Barbeiro, anônimo e Gerente com `tenant_id` nulo
- [x] pgTAP: estender o teste e desbloquear mudam o Estado de Acesso; a cortesia não bloqueia enquanto vale e segue a regra do teste vencido depois do fim
- [x] Teste do front: a lista mostra a situação; o detalhe mostra os dados e executa as ações com confirmação
- [x] `npm run lint`, `npm test` e `npm run build` passam
- [x] Revisão de código (`/code-review` no nível máximo: 10 buscadores e uma varredura; 15 achados, todos aplicados, ver "Revisão de código")

## Resultado (2026-10-02)

**Banco** (migration `20261002164545_052_ticket15_ferramentas_do_proprietario`, só no DEV):
- **Sete funções `public.admin_*`**, `security definer`, só `authenticated` com `EXECUTE` e a guarda `private.assert_saas_admin()` dentro (papel `proprietario` ativo; recusa Gerente, Barbeiro e Gerente sem `tenant_id` com `ADMIN_ONLY`/42501; o anônimo nem tem `EXECUTE`): `admin_extend_trial(tenant, dia)`, `admin_set_courtesy(tenant, dia?)`, `admin_end_courtesy(tenant)`, `admin_unblock_tenant(tenant, dia, motivo)`, `admin_block_tenant(tenant, motivo)` (numa barbearia já bloqueada e liberada à mão, encerra o desbloqueio na hora), `admin_get_tenant_subscription(tenant)` (jsonb: barbearia com o fuso como o banco o usa, assinatura com plano e plano agendado, Estado de Acesso de hoje, profissionais ativos, últimas 50 cobranças, o desbloqueio em vigor com o motivo, só enquanto vale, e as últimas 20 ações do Proprietário nessa barbearia) e `admin_list_failed_billing_notices(limite = 50)` (de 1 a 200, dos últimos 30 dias, com o nome da barbearia).
- **O desbloqueio é uma data em cima da assinatura**: `tenant_subscriptions.unblocked_until`. A situação e o motivo do bloqueio não mudam. `private.subscription_access_state` devolve `warning/unblocked` enquanto a data vale e, depois dela, o motivo de antes com a data relevante `greatest(data de antes, fim do desbloqueio)` (é dali que a rotina diária grava `blocked_at` e que contam os 7 dias da Instância WhatsApp). O gatilho `trg_clear_unblock_on_access_change` tira a data quando muda o que define o acesso: a situação, o fim do teste, o fim da cortesia, o fim do período pago, a data da primeira recusa ou a do cancelamento (pagamento aprovado, bloqueio da rotina, cortesia, estender o teste, assinar de novo); cartão, plano, id no Mercado Pago e motivo do bloqueio não o tiram. `private.whatsapp_instance_deletion_verdict` trata o desbloqueio em vigor como `not_blocked` e conta os 7 dias do fim dele.
- **Erros** (`message`/SQLSTATE): `ADMIN_ONLY` 42501; `SUBSCRIPTION_NOT_FOUND` e `TENANT_NOT_FOUND` P0002; `INVALID_DATE` e `REASON_REQUIRED` 22023; `NOT_IN_TRIAL`, `NOT_COURTESY`, `NOT_BLOCKED` e `ALREADY_BLOCKED` 55000.
- **Dias**: as funções recebem `date` e o dia vale até 23:59:59.999999 no fuso da barbearia (`private.end_of_day_in_tenant`): a data que o Proprietário digita é a que as telas mostram (um instante na virada do dia seguinte apareceria como D+1).
- **Trilha**: cada ação grava `audit_logs` (`admin_*`, recurso `tenant_subscription`, **`tenant_id` nulo**, `details.tenant_id`, quem fez, o que mudou e o motivo). O motivo não vai para a linha da assinatura nem para o `tenant_id` do tenant: o Gerente lê as duas (a linha da própria assinatura e `audit_logs` do próprio tenant) e o motivo é nota interna.
- `view_tenants_management` ganhou `subscription_unblocked_until` e `tenant_timezone`.
- **pgTAP 78** (`78_ferramentas_do_proprietario.test.sql`, 173 asserções, 173 ok no DEV): matriz de autorização (7 funções × Gerente, Barbeiro, Gerente sem tenant e anônimo, mais as recusas que não mudam nada nem deixam rastro); estender o teste (borda no último instante do dia de Manaus, a partir do teste vencido, e as recusas); cortesia sem e com fim (borda e regra do teste vencido depois do fim) e desmarcar; desbloquear por cada um dos seis tipos de bloqueio (estado durante, no último segundo e depois, com a data relevante); mudar a data; o motivo só na trilha e o Gerente sem ler as ações; o gatilho (cada uma das seis colunas que definem o acesso tira o desbloqueio, e cartão, id no Mercado Pago, motivo do bloqueio e gravar os mesmos valores não); bloquear à mão (relógio do banco) e encerrar um desbloqueio em vigor; a Instância WhatsApp (`not_blocked`, `too_recent`, `due`); os detalhes (inclusive sem assinatura, tenant inexistente, desbloqueio que já acabou, fuso inválido e a linha de trilha que um Gerente forja); os avisos que falharam (ordem, limite, janela de 30 dias); as datas fora do razoável (`infinity`, ano 9999, mais de 20 anos) e o fim do dia em Havana e em Nuuk; os avisos de bloqueio por e-mail respeitando o desbloqueio; os auxiliares privados fechados; a rotina diária respeitando o desbloqueio e gravando o fim dele como data do bloqueio. Regressão no DEV: pgTAP 65, 66, 68, 69, 74, 75 e 76 verdes (rodados com o corredor que coleta todas as asserções, `columns_are` e `has_*` inclusive).

**Front** (`src/modules/proprietario/`, `src/components/admin/`, `src/pages/admin/Tenants.tsx`):
- Módulo `proprietario`: `ProprietarioRepository` (recusa barbearia, dia e motivo em branco ou no formato errado antes de ir ao banco e traduz o erro do banco), `SupabaseProprietarioAdapter` (chama as funções `admin_*`), `InMemoryProprietarioAdapter`, os hooks `useDetalhesDoTenant`, `useAvisosQueFalharam` e `useAcoesDoProprietario` (reaproveita `useAcaoDoGerente`), e `apresentacao.ts` (`acoesDisponiveis`, `textoDoAcesso`, rótulos).
- **Admin > Tenants**: a lista mostra a situação de cada barbearia e, nas desbloqueadas, "Liberada até DD/MM" no fuso dela; o botão "Detalhes" abre a gaveta `DetalhesDoTenant` (Estado de Acesso de hoje, assinatura, profissionais "2 de 5", cobranças, ids e cartão do Mercado Pago, desbloqueio com o motivo, ações já feitas) com as ações que o estado da barbearia permite, cada uma numa pergunta de confirmação (`PainelDaAcao`) que diz o que acontece e pede o dia e o motivo; um cartão acima da lista mostra os avisos por e-mail que falharam (`AvisosQueFalharam`).
- **Gerente**: a faixa de aviso ganhou o motivo `unblocked` ("Acesso liberado manualmente até DD/MM. Regularize a assinatura para não ter o acesso bloqueado.").
- Saiu o interino do ticket 03: `camposDaMudancaManual`, os três botões ("Dar cortesia", "Suspender" e "Bloquear") e a escrita direta em `tenant_subscriptions` com o relógio do navegador (achado 6 da revisão do ticket 13).
- Vitest: módulo `proprietario`, componentes `admin` (a gaveta, o painel da ação e os avisos), página `Tenants` (9), `mensagensDeAcesso` +3; `situacaoDaAssinatura` −3 (o interino). Depois da revisão, o Vitest completo tem 2215 testes em 157 arquivos: 2214 passam, e 1 de `MinhaAgenda` (a agenda do Barbeiro, sem relação com este ticket) estoura sob a carga da rodada completa nas duas vezes em que rodei e passa isolado (27/27), como já estava registrado nos tickets 12 e 14. Checagem de mutação (7 mutações no que a tela exige: o motivo, o relê depois da ação, o dia mínimo de estender, o fuso do desbloqueio, a regra de quando desbloquear, o trim do motivo e a data do adaptador, e mais 14 na revisão, 7 nos módulos e 7 nos componentes): todas pegas.

### Decisões
- **O desbloqueio é uma data, e não uma situação nova nem uma cortesia com fim.** Uma cortesia com fim perderia o motivo do bloqueio e deixaria o pagamento que o Mercado Pago aprovar como "só histórico" (a regra da cortesia); com a data em cima da assinatura, o pagamento reativa a barbearia pelos caminhos de sempre e, passada a data, o bloqueio de antes volta sozinho.
- **O motivo só na trilha de auditoria, com `tenant_id` nulo**, porque o Gerente lê a linha da assinatura e `audit_logs` do próprio tenant.
- **Dia, e não instante, no fuso da barbearia**: o banco converte e confere; o `min` dos campos de data usa o relógio do navegador só para ajudar (quem decide é o banco). Cortou-se o fim do dia em 23:59:59.999999, e não na virada, para a data digitada ser a mostrada.
- **Estender o teste**: só para quem está em teste ou teve o teste ou a cortesia vencidos, e não encurta (o teste que ainda vale só vai para depois do fim dele). Quem está bloqueado por outro motivo se desbloqueia.
- **Desmarcar a cortesia é encerrá-la agora**: bloqueada na hora, motivo `courtesy_expired`, e é dali que contam os 7 dias da Instância WhatsApp (a regra da spec para depois do fim da cortesia).
- **Um bloqueio à mão (`admin_block_tenant`) entrou**, além do que o ticket listava: é a "Suspender" que a tela já tinha, agora no relógio do banco e com motivo, e fecha o achado 6 da revisão do ticket 13. A "Bloquear" interina, que gravava `canceled`, saiu: cancelar a assinatura é o fluxo do Gerente (ticket 12).
- **A Exclusão da Instância WhatsApp respeita o desbloqueio** (o ticket 13 decidia pela situação e por `blocked_at`).
- **Os erros do banco são códigos** (`message`), traduzidos no repositório, e não texto: a tela não depende do idioma da exceção.
- **Ações e botões**: a gaveta só oferece o que o estado permite (a mesma regra que as funções aplicam e recusam); uma ação por vez; cada uma pede confirmação com o texto do que acontece.
- **Encerrar um desbloqueio é bloquear de novo** (`admin_block_tenant` numa barbearia bloqueada com desbloqueio em vigor): a data do desbloqueio vira a de agora, e dali contam os 7 dias da Instância WhatsApp, como quando o desbloqueio acaba sozinho. Sem desbloqueio em vigor, continua `ALREADY_BLOCKED`.
- **O desbloqueio sai quando muda o que define o acesso**, e não só a situação: estender o teste de quem segue em teste ou mudar o fim da cortesia troca a data e mantém a situação, e uma data antiga de desbloqueio seguraria o bloqueio de depois. Cartão, plano, id no Mercado Pago e motivo do bloqueio não mexem no acesso e não o tiram.
- **O aviso de bloqueio por e-mail decide pelo Estado de Acesso**: a barbearia liberada à mão não o recebe (nem vale o que estava na fila), e acabado o desbloqueio sai com o fim dele como data do bloqueio (a data relevante do Estado de Acesso), dentro dos 3 dias de sempre.
- **As datas não passam de 20 anos à frente** (`INVALID_DATE`): `infinity` e o ano digitado errado (2206 no lugar de 2026) não são um dia que a tela saiba mostrar. A gaveta mostra o ano do desbloqueio.
- **O fim do dia é o menor de dois candidatos** (a meia-noite do dia seguinte, e as 23:59:59.999999 do dia, mais 1 µs), porque cada um erra num caso (Havana e Açores repetem a meia-noite; Nuuk pula as 23:00). Conferido em cerca de 1.200 fusos e 450 dias: só o dia que Samoa pulou em 2011 falha.
- **A trilha só conta as linhas sem `tenant_id`**: o Gerente também grava em `audit_logs` (a política deixa, com o `tenant_id` dele) e não pode passar por uma ação do Proprietário; de quebra a consulta usa o índice do `tenant_id` (a leitura de `audit_logs` inteira levava 1,3 a 2 s com 1 milhão de linhas, e o `authenticated` tem 8 s).
- **Os avisos que falharam são os dos últimos 30 dias**: `failed` não sai de lá por conta própria, e sem a janela o cartão nunca voltaria a "nenhum aviso falhou" depois de a chave do Resend ser trocada. A lista mostra os 50 mais recentes, e "50+" diz que há mais.

### Revisão de código (2026-10-02)
`/code-review` no nível máximo (dez buscadores: linha a linha, comportamento removido, rastreio entre arquivos, armadilhas da linguagem, camadas, reuso, simplificação, eficiência, altura da correção e convenções; mais uma varredura): 15 achados, todos confirmados (a maior parte reproduzida no DEV por mais de um buscador) e aplicados:
1. **O desbloqueio sobrevivia a estender o teste e a mudar o fim da cortesia** (a situação não muda, só a data): o gatilho agora olha as seis colunas que definem o acesso (`trg_clear_unblock_on_access_change`).
2. **E-mail de bloqueio para a barbearia desbloqueada**: `enqueue_billing_notices` e `billing_notice_is_current` decidem pelo Estado de Acesso, com a data relevante como evento.
3. **A trilha confiava em linhas que o Gerente grava** (a política de insert deixa, com o `tenant_id` dele): as duas leituras só contam `tenant_id is null`, o que de quebra tira a leitura de `audit_logs` inteira.
4. **Datas sem limite** (`infinity`, ano 9999, 2206): `end_of_day_in_tenant` recusa mais de 20 anos; a gaveta mostra o ano do desbloqueio.
5. **O fuso inválido derrubava a lista e a gaveta** (o `Intl` lança `RangeError`): o banco devolve o fuso que usa; `dataCurta` e `dataCompleta` caem em Brasília.
6. **Desbloqueio sem como encerrar**: `admin_block_tenant` encerra o desbloqueio em vigor, e a liberada à mão ganha o botão "Bloquear".
7. **pgTAP 65 vermelho** (`columns_are` sem `unblocked_until`) e a nota falsa de "65 verde": o corredor que eu usava só coletava `is`, `ok`, `isnt`, `throws_*`, `lives_ok` e `matches`; agora coleta todas as asserções (os arquivos passaram a conferir `plan` contra o número coletado).
8. **O desbloqueio que já acabou aparecia como em vigor** na gaveta: `unblock` só vem enquanto vale.
9. **"Profissionais ativos" contra o limite errado** com uma descida agendada: conta contra o menor, e o plano agendado mostra o limite.
10. **A cortesia desfaz a descida agendada em silêncio**: o painel avisa.
11. **A gaveta não relia depois de uma recusa por estado**: relê.
12. **O cartão dos avisos cortava a conta em 50 e nunca limpava**: janela de 30 dias e "50+".
13. **"até 1 profissionais"**: plural certo.
14. **Fim do dia errado onde a meia-noite se repete** (Havana, Açores): menor de dois candidatos, e Nuuk, onde as 23:00 não existem, passou a ter teste.
15. **pgTAP 78 não provava que os auxiliares privados estão fechados**: asserções, com o Gerente sem `tenant_id`.
Também, por estar na mesma função: o motivo só de tabulação ou quebra de linha passava (`btrim` só tira espaços). Os testes das correções falharam antes e passaram depois (pgTAP 78 no DEV: 28 de 54 falhavam antes da migration; mutações nos testes do front: todas pegas).

### Limitações
- **Estender o teste não muda a primeira cobrança no Mercado Pago**: com o cartão já autorizado, ela sai na data que ele marcou (a tela avisa).
- **Cortesia e bloqueio à mão não tocam o Mercado Pago**: a barbearia com assinatura viva lá continua sendo cobrada (a tela de cortesia avisa), e um pagamento aprovado numa barbearia bloqueada à mão a reativa (a regra do webhook para bloqueada).
- **O desbloqueio não impede um e-mail de bloqueio que já estava na fila** de sair.
- **A RLS ainda deixa o Proprietário escrever direto em `tenant_subscriptions`** pelo PostgREST (as políticas de insert, update e delete são dele); a tela não escreve mais assim, e as funções são o caminho com regra e trilha.
- **O painel do Proprietário (`get_admin_dashboard_metrics`) conta `blocked` pela situação**, então a barbearia desbloqueada à mão ainda entra em "suspensas".
- **A cortesia numa barbearia com descida de plano agendada a desfaz** (o gatilho do ticket 11 tira o agendamento de quem não tem cobrança), e o Mercado Pago segue cobrando o valor do plano menor: a tela de cortesia avisa antes de confirmar, e o que fazer é cancelar a assinatura lá (ou desfazer a cortesia).
- **Ficou para depois (candidatos de limpeza fora do corte de 15 da revisão):** `PainelDaAcao` grande e com o par de rádios à mão (há `Radio` em `ui`); campos que ninguém lê em `proprietario/types.ts`; tabelas à mão no lugar do `Table` de `ui`; `AcessoDoTenant` e `PlanoDoTenant` que repetem `EstadoDeAcesso` e `Plano`; `private.log_admin_action` ao lado de `public.log_audit_event`; o preâmbulo repetido das funções `admin_*`; `Tenants.tsx` lê `view_tenants_management` direto do Supabase (já era assim; a regra "Module pattern" do CLAUDE.md pede o par repositório/adaptador); o `acoesDisponiveis` do front que repete as regras do banco (poderia vir de `admin_get_tenant_subscription`); a lista inteira relida depois de cada ação; `Intl` sem cache em `dataCurta`/`dataCompleta` (13 ms por abertura da gaveta com 50 cobranças); o veredito da Instância WhatsApp que refaz à mão a regra do desbloqueio em vez de perguntar ao Estado de Acesso.
- **Não repeti o clique na tela real do DEV**: o navegador embutido abriu deslogado e a senha do Proprietário é do usuário. O que foi visto funcionando: o banco (pgTAP, regressão e consultas no DEV), as funções pelas chamadas do adaptador com cliente falso (nomes dos parâmetros conferidos contra a migration) e a tela pelos testes de componente.
