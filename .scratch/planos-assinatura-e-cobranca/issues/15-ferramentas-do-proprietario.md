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

**Status:** in-progress

- [x] pgTAP: cada função funciona para o Proprietário e é recusada para Gerente, Barbeiro, anônimo e Gerente com `tenant_id` nulo
- [x] pgTAP: estender o teste e desbloquear mudam o Estado de Acesso; a cortesia não bloqueia enquanto vale e segue a regra do teste vencido depois do fim
- [x] Teste do front: a lista mostra a situação; o detalhe mostra os dados e executa as ações com confirmação
- [x] `npm run lint`, `npm test` e `npm run build` passam
- [ ] Revisão de código (`/code-review`)

## Resultado (2026-10-02)

**Banco** (migration `20261002164545_052_ticket15_ferramentas_do_proprietario`, só no DEV):
- **Sete funções `public.admin_*`**, `security definer`, só `authenticated` com `EXECUTE` e a guarda `private.assert_saas_admin()` dentro (papel `proprietario` ativo; recusa Gerente, Barbeiro e Gerente sem `tenant_id` com `ADMIN_ONLY`/42501; o anônimo nem tem `EXECUTE`): `admin_extend_trial(tenant, dia)`, `admin_set_courtesy(tenant, dia?)`, `admin_end_courtesy(tenant)`, `admin_unblock_tenant(tenant, dia, motivo)`, `admin_block_tenant(tenant, motivo)`, `admin_get_tenant_subscription(tenant)` (jsonb: barbearia, assinatura com plano e plano agendado, Estado de Acesso de hoje, profissionais ativos, últimas 50 cobranças, o último desbloqueio com o motivo e as últimas 20 ações do Proprietário nessa barbearia) e `admin_list_failed_billing_notices(limite = 50)` (de 1 a 200, com o nome da barbearia).
- **O desbloqueio é uma data em cima da assinatura**: `tenant_subscriptions.unblocked_until`. A situação e o motivo do bloqueio não mudam. `private.subscription_access_state` devolve `warning/unblocked` enquanto a data vale e, depois dela, o motivo de antes com a data relevante `greatest(data de antes, fim do desbloqueio)` (é dali que a rotina diária grava `blocked_at` e que contam os 7 dias da Instância WhatsApp). O gatilho `trg_clear_unblock_on_status_change` tira a data quando a situação muda (pagamento aprovado, bloqueio da rotina, cortesia). `private.whatsapp_instance_deletion_verdict` trata o desbloqueio em vigor como `not_blocked` e conta os 7 dias do fim dele.
- **Erros** (`message`/SQLSTATE): `ADMIN_ONLY` 42501; `SUBSCRIPTION_NOT_FOUND` e `TENANT_NOT_FOUND` P0002; `INVALID_DATE` e `REASON_REQUIRED` 22023; `NOT_IN_TRIAL`, `NOT_COURTESY`, `NOT_BLOCKED` e `ALREADY_BLOCKED` 55000.
- **Dias**: as funções recebem `date` e o dia vale até 23:59:59.999999 no fuso da barbearia (`private.end_of_day_in_tenant`): a data que o Proprietário digita é a que as telas mostram (um instante na virada do dia seguinte apareceria como D+1).
- **Trilha**: cada ação grava `audit_logs` (`admin_*`, recurso `tenant_subscription`, **`tenant_id` nulo**, `details.tenant_id`, quem fez, o que mudou e o motivo). O motivo não vai para a linha da assinatura nem para o `tenant_id` do tenant: o Gerente lê as duas (a linha da própria assinatura e `audit_logs` do próprio tenant) e o motivo é nota interna.
- `view_tenants_management` ganhou `subscription_unblocked_until` e `tenant_timezone`.
- **pgTAP 78** (`78_ferramentas_do_proprietario.test.sql`, 123 asserções, 123 ok no DEV): matriz de autorização (7 funções × Gerente, Barbeiro, Gerente sem tenant e anônimo, mais as recusas que não mudam nada nem deixam rastro); estender o teste (borda no último instante do dia de Manaus, a partir do teste vencido, e as recusas); cortesia sem e com fim (borda e regra do teste vencido depois do fim) e desmarcar; desbloquear por cada um dos seis tipos de bloqueio (estado durante, no último segundo e depois, com a data relevante); mudar a data; o motivo só na trilha e o Gerente sem ler as ações; o gatilho; bloquear à mão (relógio do banco); a Instância WhatsApp (`not_blocked`, `too_recent`, `due`); os detalhes (inclusive sem assinatura e tenant inexistente); os avisos que falharam (ordem, limite); a rotina diária respeitando o desbloqueio e gravando o fim dele como data do bloqueio. Regressão no DEV: pgTAP 65, 66, 68, 74, 75 e 76 verdes.

**Front** (`src/modules/proprietario/`, `src/components/admin/`, `src/pages/admin/Tenants.tsx`):
- Módulo `proprietario`: `ProprietarioRepository` (recusa barbearia, dia e motivo em branco ou no formato errado antes de ir ao banco e traduz o erro do banco), `SupabaseProprietarioAdapter` (chama as funções `admin_*`), `InMemoryProprietarioAdapter`, os hooks `useDetalhesDoTenant`, `useAvisosQueFalharam` e `useAcoesDoProprietario` (reaproveita `useAcaoDoGerente`), e `apresentacao.ts` (`acoesDisponiveis`, `textoDoAcesso`, rótulos).
- **Admin > Tenants**: a lista mostra a situação de cada barbearia e, nas desbloqueadas, "Liberada até DD/MM" no fuso dela; o botão "Detalhes" abre a gaveta `DetalhesDoTenant` (Estado de Acesso de hoje, assinatura, profissionais "2 de 5", cobranças, ids e cartão do Mercado Pago, desbloqueio com o motivo, ações já feitas) com as ações que o estado da barbearia permite, cada uma numa pergunta de confirmação (`PainelDaAcao`) que diz o que acontece e pede o dia e o motivo; um cartão acima da lista mostra os avisos por e-mail que falharam (`AvisosQueFalharam`).
- **Gerente**: a faixa de aviso ganhou o motivo `unblocked` ("Acesso liberado manualmente até DD/MM. Regularize a assinatura para não ter o acesso bloqueado.").
- Saiu o interino do ticket 03: `camposDaMudancaManual`, os três botões ("Dar cortesia", "Suspender" e "Bloquear") e a escrita direta em `tenant_subscriptions` com o relógio do navegador (achado 6 da revisão do ticket 13).
- Vitest: módulo `proprietario` 97 testes, componentes `admin` 35, página `Tenants` 9, `mensagensDeAcesso` +3; `situacaoDaAssinatura` −3 (o interino). Checagem de mutação (7 mutações no que a tela exige: o motivo, o relê depois da ação, o dia mínimo de estender, o fuso do desbloqueio, a regra de quando desbloquear, o trim do motivo e a data do adaptador): todas pegas.

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

### Limitações
- **Estender o teste não muda a primeira cobrança no Mercado Pago**: com o cartão já autorizado, ela sai na data que ele marcou (a tela avisa).
- **Cortesia e bloqueio à mão não tocam o Mercado Pago**: a barbearia com assinatura viva lá continua sendo cobrada (a tela de cortesia avisa), e um pagamento aprovado numa barbearia bloqueada à mão a reativa (a regra do webhook para bloqueada).
- **O desbloqueio não impede um e-mail de bloqueio que já estava na fila** de sair.
- **A RLS ainda deixa o Proprietário escrever direto em `tenant_subscriptions`** pelo PostgREST (as políticas de insert, update e delete são dele); a tela não escreve mais assim, e as funções são o caminho com regra e trilha.
- **O painel do Proprietário (`get_admin_dashboard_metrics`) conta `blocked` pela situação**, então a barbearia desbloqueada à mão ainda entra em "suspensas".
- **Não repeti o clique na tela real do DEV**: o navegador embutido abriu deslogado e a senha do Proprietário é do usuário. O que foi visto funcionando: o banco (pgTAP, regressão e consultas no DEV), as funções pelas chamadas do adaptador com cliente falso (nomes dos parâmetros conferidos contra a migration) e a tela pelos testes de componente.
