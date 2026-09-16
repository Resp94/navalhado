# 05: Compromissos sem Data

**What to build:** o gestor passa a ver, numa linha própria, quanto a barbearia deve hoje à equipe
entre comissões e gorjetas em aberto, já descontados os vales a abater. É dinheiro comprometido que
hoje não aparece junto do resto.

Os **Compromissos sem Data** não são distribuídos entre os períodos nem entram na curva: distribuí-los
exigiria inventar uma data de quitação, e quando quitar é decisão do gestor. O resumo mostra o valor
ao fim do período e o mesmo valor depois dos Compromissos sem Data.

O total é a soma, por profissional, do líquido sugerido que a própria Quitação de Comissão exibe e
liquida (comissão em aberto com legado, mais gorjetas em aberto, menos vales em aberto, com piso zero
por profissional). Reusar o contrato por profissional garante que a linha do fluxo e as telas de
quitação nunca divirjam. O contrato de saldo do tenant não serve: cobre só comissão, compensa
profissionais entre si no legado e conta como pago o legado de quitações estornadas. O piso por
profissional impede que o vale de um esconda o crédito de outro; profissionais inativos e arquivados
entram, para que a dívida com ex-profissional não suma.

**Cadeia sequencial:** este ticket redefine a mesma função de leitura do fluxo que os tickets 01, 02,
03, 07 e 08. Não pode correr em paralelo com outro ticket da cadeia.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seção "Compromissos sem Data".

**Blocked by:** 03 (entradas estimadas por dia da semana), 04 (curva, saldo informado e primeiro
período negativo).

**Status:** done

- [x] Contrato devolve Compromissos sem Data com comissões em aberto, gorjetas em aberto, vales a
      abater e líquido devido, calculados no momento da consulta.
- [x] O líquido devido é igual à soma do líquido sugerido do contrato de saldo de comissão por
      profissional, para todos os profissionais do tenant.
- [x] Profissional com vale acima do que tem a receber contribui com zero e não reduz o que a casa
      deve aos colegas.
- [x] Profissional inativo ou arquivado com saldo em aberto é incluído.
- [x] Compromissos sem Data não entram em nenhum agrupamento, no fluxo pendente nem na curva.
- [x] Cartão de Compromissos sem Data na aba com total e componentes, e link para a aba de Comissões.
- [x] O cartão avisa que o total pode ser maior que "comissões + gorjetas − vales" quando algum vale
      supera o devido.
- [x] Resumo ganha o cartão de valor depois dos Compromissos sem Data, ao lado do valor ao fim do
      período.
- [x] Adaptador Supabase converte os campos novos, com teste de campos ausentes.
- [x] `CONTEXT.md` ganha o termo Compromissos sem Data.
- [x] Casos adicionados ao arquivo pgTAP do fluxo de caixa projetado.
- [x] `npm run test` e `npm run test:db` verdes.

**Notas de implementação:**

- **Migration:** `supabase/migrations/20260914190000_fluxo_de_caixa_projetado_compromissos_sem_data.sql`
  — `create or replace` das duas funções (mesma assinatura dos tickets 01-03). Sem índice novo (a
  consulta por profissional não filtra por data).
- **`undated_commitments`:** calculado com uma única `select` sobre
  `public.get_professional_commission_balance(prof.id, null, null, p_tenant_id)` por profissional do
  tenant (sem filtro de `is_active`/`deleted_at` -- ativo, inativo e arquivado entram), somando
  `current_open_balance`, `credits_open_amount`, `advances_open_amount` e `suggested_net_amount`. O
  piso zero por profissional (`greatest(0, ...)`) já é aplicado *dentro* da função reusada, então a
  soma de `suggested_net_amount` nunca deixa o vale excedente de um profissional reduzir o líquido
  devido pelos colegas -- confirmado por smoke test via MCP antes de escrever o pgTAP.
- **Achado corrigido antes de aplicar no DEV (não estava no plano original):** o primeiro pgTAP
  escrito reusava `tenant_a_id` do contexto compartilhado do arquivo (`ticket31_context`), e falhou 1
  de 40 na validação final. Causa: `get_professional_commission_balance` soma vale/gorjeta em aberto
  só por `status` (`open`/`partially_paid`), **sem filtrar `reversed_at`** -- o vale "estornado" do
  ticket 02 (`status = 'open'`, `reversed_at` preenchido só para testar a leitura *própria* do fluxo
  de caixa, que filtra por `reversed_at`) continuava contando como aberto nessa função reusada,
  inflando `advances_open` em +888. Corrigido dando ao ticket 05 um tenant e um gerente próprios, sem
  reusar `tenant_a_id` -- mais isolado e imune a qualquer dado que tickets futuros venham a acrescentar
  ao mesmo tenant.
- **Acesso dentro do núcleo:** `get_professional_commission_balance` faz sua própria checagem de
  `auth.uid()`/papel/tenant (função `security definer` chamada de dentro de outra `security definer`).
  Como `auth.uid()` reflete sempre o usuário autenticado real da sessão (não muda com `SECURITY
  DEFINER`), a checagem interna passa transparentemente porque o usuário já foi validado pela função
  pública externa -- confirmado que falha com "Acesso negado" se `request.jwt.claim.sub` não estiver
  setado (smoke test inicial, antes de perceber que era preciso `set_config` mesmo chamando o núcleo
  privado diretamente nos testes).
- **pgTAP:** casos novos no mesmo arquivo dos tickets 01-03
  (`supabase/tests/database/31_fluxo_de_caixa_projetado.test.sql`), plano 38 → 40. Tenant/gerente
  próprios (`ticket35_context`).
- **Frontend:** `FluxoCaixaUndatedCommitments` novo em `types.ts`; `SupabaseFluxoCaixaAdapter` converte
  com `toUndatedCommitments`; `FluxoCaixaResumo` ganha o cartão "Compromissos sem Data" (total e
  componentes, link para `/financeiro/comissoes`, aviso condicional quando `net_due >
  commission_open + tips_open - advances_open` -- comparação aritmética no cliente, não um campo novo
  do contrato) e o cartão "Valor depois dos Compromissos sem Data" (= saldo/resultado ao fim do
  período do ticket 04, menos `net_due`, só quando o último ponto da curva tem saldo).
