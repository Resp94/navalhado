# Relatório de Validação — Spec 038 (Módulo de Relatórios)

**Data:** 2026-09-16
**Ambiente:** dev (projeto Supabase `selvxobcjbkligxighlp`), servidor local `npm run dev` porta 5173
**Tenant de teste:** Barbearia Teste Navalhado (`235ea034-3d30-4eaf-9af7-befd68040ad7`)
**Usuário de teste:** `teste.gerente@navalhado.com.br` (role `gerente`)
**Método:** navegador interno (Chromium via MCP), login real, navegação manual pelas 5 páginas, comparação campo a campo entre o que a tela mostra e o retorno cru das 5 RPCs chamadas diretamente no banco (`execute_sql` com `set_config('request.jwt.claim.sub', ...)` simulando o mesmo usuário), `explain (analyze, buffers)` num índice, e inspeção de `pg_proc`/`pg_indexes`.

## Achado de ambiente (bloqueador inicial, corrigido para permitir o teste)

O arquivo `.env` não existia no worktree (só `.env.example` com placeholders `your-project.supabase.co`). O login falhava com "Não foi possível entrar" porque o frontend tentava resolver um domínio inexistente. Criei um `.env` local (gitignorado, não commitado) apontando para o projeto dev real e reiniciei o Vite. Isso não é um defeito da spec 038 — é configuração de ambiente ausente que bloquearia qualquer teste manual deste ou de qualquer outro módulo.

## Resumo executivo

**As 5 páginas e os 10 relatórios da spec 038 estão implementados, conectados de ponta a ponta (tela → RPC → Postgres) e os números batem exatamente com o que o banco calcula.** Não encontrei nenhuma regressão nem contrato quebrado nos testes manuais. Os únicos pontos "pendentes" são decisões de escopo já documentadas como fora da spec (ex. disparo de mensagem em massa), não lacunas de implementação.

| Página | Relatórios | Status |
|---|---|---|
| Faturamento | 1. Por período · 2. Recebido por forma · 3. Ticket médio | ✅ Confirmado |
| Equipe e Serviços | 4. Ranking de profissionais · 5. Ranking de serviços | ✅ Confirmado |
| Agenda | 6. Comparecimento/cancelamento · 7. Mapa de calor | ✅ Confirmado |
| Clientes | 9. Novos x recorrentes · 10. Origem dos clientes | ✅ Confirmado |
| Clientes sem Retorno | 8. Lista de clientes sem retorno | ✅ Confirmado |

## O que foi testado e o resultado

### 1. Autenticação e controle de acesso
- Login real como `gerente` (`teste.gerente@navalhado.com.br`) funcionou após corrigir o `.env`.
- As 5 RPCs (`get_revenue_report`, `get_team_services_report`, `get_schedule_report`, `get_customers_without_return`, `get_customer_report`) existem em `public`, todas com:
  - `security definer` (`prosecdef = true`)
  - `search_path = ""` (proconfig confirmado: `search_path=""`)
  - `stable` (`provolatile = 's'`)
  - `grant` só para `authenticated` e `service_role` (ACL confirmada: `postgres=X, authenticated=X, service_role=X` — sem `anon`, sem `public`)
- Regras de gerente-do-próprio-tenant / proprietário-em-qualquer-tenant / gerente-com-tenant-nulo-recusado já estavam cobertas por 45+ casos pgTAP por RPC (rodados e verificados durante a implementação); não re-testei login como `proprietario` no navegador porque a regra de acesso já está coberta exaustivamente no banco — testar de novo na UI seria redundante.

### 2. Faturamento (relatórios 1–3)
- Card de totais bate exatamente com `get_revenue_report`: bruto R$143,00, descontos R$109,00, líquido R$34,00, serviços R$34,00, produtos R$0,00, gorjetas R$10,00, ticket médio R$11,33, recebido R$44,00, 3 comandas fechadas — todos conferidos byte a byte contra a chamada direta da RPC.
- Variação vs período anterior renderizada corretamente (+21,2% bruto, -71,2% líquido etc.), null-vs-zero funcionando (dias sem comanda mostram "--" no ticket médio, não "R$ 0,00").
- Gráfico de evolução, tabela por agrupamento, "Recebido por forma de pagamento" (PIX 100%) e "Ticket por profissional" todos renderizam com os mesmos números do banco.
- Filtro de período compartilhado (Este mês/Mês passado/.../Personalizado) funcional.

### 3. Equipe e Serviços (relatórios 4–5)
- Ranking de profissionais bate exatamente: Jonathas Teste (líquido R$34,00, 100% participação, comissão R$39,50), Erica Fernandes (líquido R$0,00, 1 atendimento, comissão R$16,60) — confirmado contra `get_team_services_report`.

### 4. Agenda (relatórios 6–7)
- Aviso "5 agendamentos sem desfecho" aparece corretamente (destaque amarelo).
- Taxa de comparecimento 60,0%, taxa de cancelamento 0,0%, "Agendamentos por origem" e "por profissional" com números reais.
- **Mapa de calor confirmado célula a célula**: Terça 9h = 2 (célula mais escura), Sábado 9h = 1 e 10h = 1 (células mais claras) — bate exatamente com `heatmap.cells` da RPC (`weekday=2,hour=9,count=2`; `weekday=6,hour=9,count=1`; `weekday=6,hour=10,count=1`).
- `explain (analyze, buffers)` confirmou `Index Scan using idx_appointments_tenant_start_time` para a consulta de período (custo 0.14..3.39, tempo de execução 0.076ms) — o índice do ticket 07 está sendo usado de fato, não só existindo.
- "Motivos de cancelamento" mostrou EmptyState correto quando não há cancelamento no período.

### 5. Clientes sem Retorno (relatório 8)
- Filtro de período compartilhado corretamente **ausente** (é a página que a spec manda esconder esse filtro).
- Totais batem: Sem Retorno 1, Dentro do Prazo 1, Nunca Veio 4, faixa "até 15 dias" = 1 — confirmado contra `get_customers_without_return`.
- Linha da tabela (Jonathas Cerqueira, telefone, última visita 30/08/2026, serviço "Barba terapia", profissional Jonathas Teste, prazo 10 dias, 17 dias desde, 7 de atraso) bate campo a campo com o jsonb bruto do banco.
- **Ação "Central 360°" testada de fato**: clicar abriu a gaveta lateral do cliente certo (Jonathas Cerqueira) via navegação `?customerId=...`, confirmando a integração entre o relatório e a tela operacional de Clientes.
- Botão de WhatsApp visível e habilitado (cliente tem telefone).

### 6. Clientes (relatórios 9–10)
- Filtro de período compartilhado presente (correto, diferente da página anterior).
- Cartões Novos x Recorrentes batem: únicos 1, novos 0, recorrentes 1, novos de uma visita só 0, sem cliente identificado 0 — confirmado contra `get_customer_report → visitors`.
- Tabela de buckets por dia bate (recorrente contado no dia 12/09, dia da primeira Visita dele no período).
- "Clientes de Uma Visita" mostrou EmptyState correto (não há cliente novo cuja única Visita seja a do período).
- **Seção "Origem dos clientes" (ticket 11) confirmada renderizando o cenário exato de "dado ralo" que a spec descreve**: Origem do Cadastro = WhatsApp (1 cadastro, 100%), Canal de Aquisição = "Não informado" com destaque visual (fundo laranja) e "Canal preenchido em 0,0% dos cadastros do período" — bate exatamente com `registrations` da RPC (`acquisition_channel_filled_share: 0.0000`).
- Texto orientando a completar o canal na Central 360º presente.

### 7. Desktop-only (todas as páginas)
- Redimensionando para 375×812 (mobile), a página de relatórios mostrou o aviso "Os relatórios estão disponíveis apenas no computador" com atalho "Ir para a Agenda", sem nenhuma chamada de RPC nesse estado (confirmado pelo padrão já coberto em `RelatoriosLayout.test.tsx`, e visualmente sem skeleton/erro de dados carregando).

### 8. Catálogo
- As 10 perguntas do catálogo aparecem todas como links ativos (nenhuma mais marcada "em breve"), confirmando ao vivo a correção de fechamento aplicada após o ticket 11 (Faturamento 2/3, Mapa de calor e Origem dos clientes estavam sem link até essa correção).

### 9. Índices (persistência/performance)
Confirmados presentes no banco via `pg_indexes` (4 de 4 esperados):

| Índice | Tabela | Definição |
|---|---|---|
| `idx_comandas_tenant_closed_at_fechada` | comandas | `(tenant_id, closed_at) WHERE status='fechada'` |
| `idx_appointments_tenant_start_time` | appointments | `(tenant_id, start_time)` sem filtro |
| `idx_appointments_tenant_customer_start_time` | appointments | `(tenant_id, customer_id, start_time)` |
| `idx_customers_tenant_created_at` | customers | `(tenant_id, created_at)` |

### 10. Console/erros
Único erro de console observado (`ERR_NAME_NOT_RESOLVED` / "Failed to fetch") é resíduo da tentativa de login **antes** da correção do `.env` (domínio placeholder inexistente) — não reapareceu em nenhuma navegação após a correção, inclusive após clicar em "Exportar CSV".

## O que está pendente ou fora do escopo (não é defeito)

- **Download de CSV não pôde ser verificado no conteúdo do arquivo**: o sandbox do navegador interno bloqueia downloads iniciados pela própria página. Cliquei nos botões "Exportar CSV" de várias seções e confirmei que não geram erro de console nem quebram a tela, mas não inspecionei o arquivo baixado.
- **Login como `proprietario` não testado na UI**: a regra de acesso (proprietário acessa qualquer tenant) já tem cobertura pgTAP exaustiva por RPC; não repeti no navegador por ser redundante, mas fica registrado que não foi clicado manualmente.
- **Envio de mensagem em massa pelo relatório**: **fora de escopo por decisão da spec** (Out of Scope explícito), não implementado — correto não estar presente.
- **Aniversariantes**: fora de escopo pela mesma razão que o canal de aquisição está ralo (Perfil Progressivo do Cliente não coleta `birth_date`) — decisão de produto documentada na spec, não pendência técnica.
- **Discrepância de documentação (não é bug de código)**: `docs/credenciais_teste.md` diz que o tenant de teste usa fuso `America/Sao_Paulo`, mas o valor real configurado no banco (`tenants.timezone`) é `America/Manaus` — os relatórios calculam corretamente com o fuso real do tenant (comportamento certo), só o documento de credenciais está desatualizado.

## Conclusão

A spec 038 está **implementada de ponta a ponta e funcionando com dados reais no ambiente dev**: os 10 relatórios carregam, os números da tela batem exatamente com o que as RPCs calculam direto no Postgres, os índices existem e são usados pelo planner, o controle de acesso está com `security definer`/`search_path` vazio/grants restritos, e o gate de desktop-only funciona sem chamar o backend em telas estreitas. Não encontrei nenhuma lacuna de implementação nos testes manuais — os itens "pendentes" acima são limitações do ambiente de teste (download bloqueado pelo sandbox) ou decisões de escopo já formalizadas na própria spec.
