# WhatsApp Client Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar ou reutilizar um cliente no primeiro contato pelo WhatsApp, coletar seu nome uma única vez na página tokenizada e liberar o agendamento sem duplicar clientes.

**Architecture:** A Edge Function identifica a instância e delega a criação idempotente a uma RPC Postgres. O banco normaliza o telefone em coluna gerada, impõe unicidade por tenant e expõe duas RPCs com privilégios mínimos. O frontend usa `cadastro_completo` como portão antes de carregar o catálogo da agenda.

**Tech Stack:** Supabase Postgres 17, Supabase MCP, pgTAP transacional, Supabase Edge Functions/Deno, TypeScript, React 19, Vitest e Testing Library.

## Global Constraints

- Obedecer RED → confirmar falha esperada → GREEN mínimo → confirmar toda a suíte → REFACTOR.
- Não escrever código de produção antes do respectivo teste falhar pelo motivo esperado.
- Usar dados reais do teste; mocks somente na fronteira HTTP/Supabase e sempre com o formato completo da resposta real.
- Não testar chamadas do mock; testar resposta HTTP, conteúdo do link e estado visível da interface.
- Normalizar telefone brasileiro para `55DDDNUMERO`; aceitar entrada local de 10/11 dígitos ou com DDI de 12/13 dígitos.
- Isolar cliente por `(tenant_id, telefone_normalizado)`; o mesmo telefone pode existir em tenants diferentes.
- Clientes atuais iniciam com `cadastro_completo = true`; somente a RPC do WhatsApp cria provisórios com `false`.
- `cadastro_completo` nunca pode regredir de `true` para `false`.
- `find_or_create_whatsapp_customer` é executável somente por `service_role`.
- RPCs públicas por token usam `SECURITY DEFINER`, `SET search_path = ''`, nomes totalmente qualificados e grants explícitos.
- O token continua bearer; OTP, limpeza de provisórios e conversa para coletar nome permanecem fora de escopo.
- Toda consulta, migração, auditoria e publicação Supabase deve usar exclusivamente o MCP Supabase; o Supabase CLI não faz parte deste plano.
- Antes de cada `apply_migration`, ensaiar migração + teste com MCP `execute_sql` dentro de uma única transação encerrada por `ROLLBACK`.
- `apply_migration` exige autorização explícita do usuário porque altera o projeto remoto `boakqstrdfqmsrwnjore`.

## Baseline validada pelo MCP Supabase em 2026-07-15

- Projeto: `boakqstrdfqmsrwnjore`.
- `public.customers`: 2 registros, RLS ativa, 0 telefones inválidos e 0 grupos duplicados após normalização.
- `cadastro_completo` e `telefone_normalizado`: ainda ausentes.
- `get_customer_details_by_token(uuid)`: atualmente `SECURITY DEFINER`, sem `search_path` fixo e executável por `PUBLIC`, `anon`, `authenticated` e `service_role`.
- O plano não depende desse estado pequeno: a migração aborta com diagnóstico se encontrar telefone inválido ou duplicidade em qualquer ambiente.

## File Map

- Create: `supabase/tests/database/customer_onboarding_schema.test.sql` — normalização, colunas, restrições e regressão de estado.
- Create: `supabase/tests/database/customer_onboarding_find_or_create.test.sql` — criação, reuso, isolamento e permissões da RPC interna.
- Create: `supabase/tests/database/customer_onboarding_registration.test.sql` — conclusão, validação, idempotência e RPC de detalhes.
- Create: `supabase/migrations/20260715120000_customer_onboarding_schema.sql` — invariantes de dados.
- Create: `supabase/migrations/20260715121000_customer_onboarding_find_or_create.sql` — RPC interna do webhook.
- Create: `supabase/migrations/20260715122000_customer_onboarding_registration.sql` — RPC pública e endurecimento da consulta por token.
- Modify: `supabase/functions/whatsapp-integration/index_test.ts` — comportamento Message para clientes novos e existentes.
- Modify: `supabase/functions/whatsapp-integration/index.ts` — trocar varredura de clientes pela RPC atômica.
- Create: `src/pages/cliente/CadastroInicialCliente.tsx` — formulário puro de primeiro nome.
- Create: `src/pages/cliente/__tests__/FluxoAgendamento.test.tsx` — portão de cadastro e integração da página.
- Modify: `src/pages/cliente/FluxoAgendamento.tsx` — bloquear catálogo e concluir cadastro.

---

### Task 1: Baseline MCP e invariantes do esquema

**Files:**
- Create: `supabase/tests/database/customer_onboarding_schema.test.sql`
- Create: `supabase/migrations/20260715120000_customer_onboarding_schema.sql`

**Interfaces:**
- Produces: `private.normalize_br_phone(text) -> text`, `customers.cadastro_completo boolean`, `customers.telefone_normalizado text generated always`, índice único `customers_tenant_telefone_normalizado_uidx`.

- [ ] **Step 1: Confirmar projeto e baseline pelo MCP**

Usar, nesta ordem:

1. MCP `get_project_url` e exigir `https://boakqstrdfqmsrwnjore.supabase.co`.
2. MCP `list_tables({ schemas: ['public'], verbose: true })` e confirmar RLS em `customers`.
3. MCP `list_migrations` para registrar o histórico anterior.
4. MCP `list_extensions` para confirmar que `pgtap` está disponível; o teste cria a extensão somente dentro da transação revertida.
5. MCP `execute_sql` com a auditoria de telefones e exigir `invalid_phone_count = 0` e `duplicate_group_count = 0`.

Expected: projeto correto; baseline registrada; nenhuma alteração persistida.

- [ ] **Step 2: RED — provar que o normalizador não existe**

Criar o teste com uma única asserção:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
select has_function(
  'private',
  'normalize_br_phone',
  array['text'],
  'normalizador brasileiro deve existir'
);
select * from finish();
rollback;
```

Run: MCP `execute_sql` com o conteúdo integral de `customer_onboarding_schema.test.sql`.

Expected: FAIL com `normalizador brasileiro deve existir`.

- [ ] **Step 3: GREEN mínimo — criar a assinatura imutável**

Criar a migração inicialmente com:

```sql
create schema if not exists private;

create or replace function private.normalize_br_phone(p_phone text)
returns text
language sql
immutable
strict
set search_path = ''
as $$ select null::text $$;

revoke all on function private.normalize_br_phone(text) from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.normalize_br_phone(text) to authenticated, service_role;
```

Run: MCP `execute_sql` com `BEGIN`, a versão mínima da migração, o corpo do teste do Step 2 sem seu `BEGIN/ROLLBACK`, e `ROLLBACK`.

Expected: PASS, 1 teste.

- [ ] **Step 4: RED — especificar normalização**

Trocar `plan(1)` por `plan(5)` e adicionar:

```sql
select is(private.normalize_br_phone('(92) 99999-2222'), '5592999992222', 'formato local móvel');
select is(private.normalize_br_phone('92 3333-4444'), '559233334444', 'formato local fixo');
select is(private.normalize_br_phone('5592999992222'), '5592999992222', 'DDI já presente');
select is(private.normalize_br_phone('9999'), null, 'telefone inválido retorna null');
```

Run: MCP `execute_sql` com a migração mínima e o teste na mesma transação revertida.

Expected: FAIL nas quatro regras de normalização; a assinatura continua verde.

- [ ] **Step 5: GREEN — implementar a normalização mínima**

Substituir apenas o corpo da função por:

```sql
as $$
  with digits as (
    select regexp_replace(p_phone, '[^0-9]', '', 'g') as value
  )
  select case
    when value ~ '^55[1-9][0-9]{9,10}$' then value
    when value ~ '^[1-9][0-9]{9,10}$' then '55' || value
    else null
  end
  from digits
$$;
```

Run: MCP `execute_sql` com a migração atual e o teste na mesma transação revertida.

Expected: PASS, 5 testes.

- [ ] **Step 6: RED — especificar colunas, unicidade e estado monotônico**

Expandir o teste para `plan(13)`. Antes das asserções de escrita, inserir dois tenants isolados e adicionar:

```sql
select has_column('public', 'customers', 'cadastro_completo', 'flag deve existir');
select col_not_null('public', 'customers', 'cadastro_completo', 'flag deve ser not null');
select has_column('public', 'customers', 'telefone_normalizado', 'telefone gerado deve existir');
select has_index('public', 'customers', 'customers_tenant_telefone_normalizado_uidx', 'unicidade por tenant');
select ok(not exists(select 1 from public.customers where not cadastro_completo), 'clientes atuais seguem completos');

insert into public.tenants(id, name, email, phone) values
('10000000-0000-0000-0000-000000000001', 'Teste A', 'onboarding-a@test.local', '92999990001'),
('10000000-0000-0000-0000-000000000002', 'Teste B', 'onboarding-b@test.local', '92999990002');

insert into public.customers(tenant_id, name, phone)
values ('10000000-0000-0000-0000-000000000001', 'Ana', '(92) 99999-3333');

select throws_ok(
  $$insert into public.customers(tenant_id, name, phone) values ('10000000-0000-0000-0000-000000000001', 'Outra', '5592999993333')$$,
  '23505', null, 'mesmo telefone no mesmo tenant deve falhar'
);

select lives_ok(
  $$insert into public.customers(tenant_id, name, phone) values ('10000000-0000-0000-0000-000000000002', 'Ana B', '5592999993333')$$,
  'mesmo telefone em outro tenant deve funcionar'
);

update public.customers set cadastro_completo = true where name = 'Ana';
select throws_ok(
  $$update public.customers set cadastro_completo = false where name = 'Ana'$$,
  'P0001', 'CUSTOMER_REGISTRATION_CANNOT_REGRESS', 'cadastro completo não regride'
);
```

Run: MCP `execute_sql` com a migração atual e o teste na mesma transação revertida.

Expected: FAIL nas colunas e índice ausentes.

- [ ] **Step 7: GREEN — adicionar migração segura e curta**

Acrescentar à migração:

```sql
do $$
declare
  v_invalid bigint;
  v_duplicate_groups bigint;
begin
  select count(*) into v_invalid
  from public.customers c
  where private.normalize_br_phone(c.phone) is null;

  select count(*) into v_duplicate_groups
  from (
    select c.tenant_id, private.normalize_br_phone(c.phone)
    from public.customers c
    group by c.tenant_id, private.normalize_br_phone(c.phone)
    having count(*) > 1
  ) duplicates;

  if v_invalid > 0 or v_duplicate_groups > 0 then
    raise exception 'CUSTOMER_PHONE_PREFLIGHT_FAILED'
      using detail = format('invalid=%s duplicate_groups=%s', v_invalid, v_duplicate_groups);
  end if;
end;
$$;

alter table public.customers add column if not exists cadastro_completo boolean;
update public.customers set cadastro_completo = true where cadastro_completo is null;
alter table public.customers alter column cadastro_completo set default true;
alter table public.customers alter column cadastro_completo set not null;

alter table public.customers
  add column if not exists telefone_normalizado text
  generated always as (private.normalize_br_phone(phone)) stored;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_telefone_normalizado_valid_chk'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_telefone_normalizado_valid_chk
      check (telefone_normalizado is not null) not valid;
  end if;
end;
$$;

alter table public.customers
  validate constraint customers_telefone_normalizado_valid_chk;

create unique index if not exists customers_tenant_telefone_normalizado_uidx
  on public.customers(tenant_id, telefone_normalizado);

create or replace function private.prevent_customer_registration_regression()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.cadastro_completo and not new.cadastro_completo then
    raise exception 'CUSTOMER_REGISTRATION_CANNOT_REGRESS';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_customer_registration_regression() from public;
drop trigger if exists customers_registration_cannot_regress on public.customers;
create trigger customers_registration_cannot_regress
before update of cadastro_completo on public.customers
for each row execute function private.prevent_customer_registration_regression();
```

Run:

1. MCP `execute_sql`: ensaiar migração completa + teste dentro de `BEGIN…ROLLBACK`.
2. Confirmar PASS, 13 testes, e nenhuma mudança persistida.
3. Após autorização do usuário, MCP `apply_migration({ name: 'customer_onboarding_schema', query: <conteúdo integral da migração> })`.
4. MCP `execute_sql`: executar novamente o teste transacional contra o esquema persistido.
5. MCP `get_advisors` para `security` e `performance`.
6. MCP `list_migrations` e confirmar `customer_onboarding_schema` uma única vez.

Expected: PASS, 13 testes; advisors sem novo alerta causado pela migração.

- [ ] **Step 8: Commit**

```powershell
rtk git add supabase/tests/database/customer_onboarding_schema.test.sql supabase/migrations/20260715120000_customer_onboarding_schema.sql
rtk git commit -m "feat: enforce customer phone identity"
```

---

### Task 2: RPC atômica para criar ou reutilizar cliente

**Files:**
- Create: `supabase/tests/database/customer_onboarding_find_or_create.test.sql`
- Create: `supabase/migrations/20260715121000_customer_onboarding_find_or_create.sql`

**Interfaces:**
- Consumes: `private.normalize_br_phone(text)` e índice único `(tenant_id, telefone_normalizado)`.
- Produces: `public.find_or_create_whatsapp_customer(p_tenant_id uuid, p_phone text, p_push_name text default null)` retornando `customer_id uuid`, `tenant_id uuid`, `token_acesso uuid`, `cadastro_completo boolean`, `created boolean`.

- [ ] **Step 1: RED — especificar assinatura e privilégio**

Criar teste pgTAP com `plan(3)`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select has_function('public', 'find_or_create_whatsapp_customer', array['uuid','text','text'], 'RPC deve existir');
select ok(not has_function_privilege('anon', 'public.find_or_create_whatsapp_customer(uuid,text,text)', 'execute'), 'anon não executa');
select ok(not has_function_privilege('authenticated', 'public.find_or_create_whatsapp_customer(uuid,text,text)', 'execute'), 'authenticated não executa');
select * from finish();
rollback;
```

Run: MCP `execute_sql` com o conteúdo integral de `customer_onboarding_find_or_create.test.sql`.

Expected: FAIL porque a função não existe.

- [ ] **Step 2: GREEN mínimo — criar contrato fechado**

Criar o contrato mínimo:

```sql
create or replace function public.find_or_create_whatsapp_customer(
  p_tenant_id uuid,
  p_phone text,
  p_push_name text default null
)
returns table(
  customer_id uuid,
  tenant_id uuid,
  token_acesso uuid,
  cadastro_completo boolean,
  created boolean
)
language sql
security definer
set search_path = ''
as $$
  select null::uuid, null::uuid, null::uuid, null::boolean, null::boolean
  where false
$$;

revoke all on function public.find_or_create_whatsapp_customer(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.find_or_create_whatsapp_customer(uuid, text, text)
  to service_role;
```

Run: MCP `execute_sql` com `BEGIN`, migração mínima, corpo do teste sem seu `BEGIN/ROLLBACK`, e `ROLLBACK`.

Expected: PASS, 3 testes.

- [ ] **Step 3: RED — especificar criação, reuso e isolamento**

Expandir o teste para cobrir, com tenants e telefones únicos:

- número novo retorna `created = true`, nome de perfil aparado, token não nulo e `cadastro_completo = false`;
- número repetido em outra formatação retorna `created = false` e o mesmo `customer_id/token_acesso`;
- reuso não sobrescreve nome nem converte cliente completo em provisório;
- `p_push_name` vazio grava `Cliente`;
- telefone inválido lança `PHONE_INVALID`/`22023`;
- tenant inexistente lança `TENANT_NOT_FOUND`/`P0002`;
- o mesmo telefone em outro tenant cria outro cliente.

Run: MCP `execute_sql` com a migração mínima e o teste comportamental na mesma transação revertida.

Expected: FAIL porque a função mínima não retorna cliente.

- [ ] **Step 4: GREEN — implementar UPSERT sem corrida**

Substituir a função SQL mínima por PL/pgSQL. A trava transacional usa somente a chave de domínio, é liberada automaticamente e não envolve o `fetch` externo:

```sql
create or replace function public.find_or_create_whatsapp_customer(
  p_tenant_id uuid,
  p_phone text,
  p_push_name text default null
)
returns table(
  customer_id uuid,
  tenant_id uuid,
  token_acesso uuid,
  cadastro_completo boolean,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalize_br_phone(p_phone);
  v_customer public.customers%rowtype;
begin
  if v_phone is null then
    raise exception 'PHONE_INVALID' using errcode = '22023';
  end if;

  if not exists (select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception 'TENANT_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || v_phone, 0)
  );

  select c.* into v_customer
  from public.customers c
  where c.tenant_id = p_tenant_id
    and c.telefone_normalizado = v_phone;

  if found then
    return query select v_customer.id, v_customer.tenant_id,
      v_customer.token_acesso, v_customer.cadastro_completo, false;
    return;
  end if;

  insert into public.customers(tenant_id, name, phone, cadastro_completo)
  values (
    p_tenant_id,
    left(coalesce(nullif(btrim(p_push_name), ''), 'Cliente'), 100),
    v_phone,
    false
  )
  on conflict (tenant_id, telefone_normalizado) do nothing
  returning * into v_customer;

  if not found then
    select c.* into strict v_customer
    from public.customers c
    where c.tenant_id = p_tenant_id
      and c.telefone_normalizado = v_phone;
  end if;

  return query select v_customer.id, v_customer.tenant_id,
    v_customer.token_acesso, v_customer.cadastro_completo, true;
end;
$$;
```

Run:

1. MCP `execute_sql`: ensaiar migração completa + teste dentro de `BEGIN…ROLLBACK`.
2. Após autorização do usuário, MCP `apply_migration({ name: 'customer_onboarding_find_or_create', query: <conteúdo integral da migração> })`.
3. MCP `execute_sql`: executar o teste transacional contra a função persistida.
4. MCP `get_advisors` para `security` e `performance`.
5. MCP `list_migrations` e confirmar uma única entrada nova.

Expected: todos os testes verdes; nenhum grant inesperado ou `search_path` ausente.

- [ ] **Step 5: Commit**

```powershell
rtk git add supabase/tests/database/customer_onboarding_find_or_create.test.sql supabase/migrations/20260715121000_customer_onboarding_find_or_create.sql
rtk git commit -m "feat: create WhatsApp customers atomically"
```

---

### Task 3: Concluir cadastro e endurecer RPC por token

**Files:**
- Create: `supabase/tests/database/customer_onboarding_registration.test.sql`
- Create: `supabase/migrations/20260715122000_customer_onboarding_registration.sql`

**Interfaces:**
- Produces: `public.complete_customer_registration(p_token uuid, p_name text)` e nova linha de retorno de `public.get_customer_details_by_token(p_token uuid)` com `cadastro_completo boolean`.

- [ ] **Step 1: RED — especificar comportamento público**

O teste pgTAP deve criar um cliente provisório e verificar:

- nome com menos de 2 ou mais de 100 caracteres lança `CUSTOMER_NAME_INVALID`/`22023`;
- token inexistente lança `TOKEN_INVALID`/`P0002`;
- token expirado lança `TOKEN_EXPIRED`/`22023`;
- nome válido é aparado, persiste e marca completo;
- segunda chamada retorna o mesmo registro sem reabrir cadastro nem mudar o nome;
- `get_customer_details_by_token` retorna `cadastro_completo = true`;
- ambas as RPCs têm `prosecdef = true` e `proconfig` contém `search_path=""`;
- `complete_customer_registration` e `get_customer_details_by_token` são executáveis por `anon`, `authenticated` e `service_role`, mas não herdam grant de `PUBLIC`.

Run: MCP `execute_sql` com o conteúdo integral de `customer_onboarding_registration.test.sql`.

Expected: FAIL porque a nova RPC e a coluna de retorno ainda não existem.

- [ ] **Step 2: GREEN — implementar conclusão idempotente**

Na migração:

1. Criar `complete_customer_registration` como `SECURITY DEFINER SET search_path = ''`.
2. Validar `char_length(btrim(p_name)) between 2 and 100`.
3. Buscar token e expiração com nomes qualificados.
4. Atualizar somente quando `cadastro_completo = false`.
5. Quando já completo, retornar o registro atual sem alterar `name`.
6. Revogar `EXECUTE` de `PUBLIC`; conceder explicitamente a `anon`, `authenticated` e `service_role`.
7. Dropar e recriar `get_customer_details_by_token(uuid)` para incluir `cadastro_completo`, fixar `search_path` e reaplicar os mesmos grants explícitos.

Run:

1. MCP `execute_sql`: ensaiar migração completa + teste dentro de `BEGIN…ROLLBACK`.
2. Após autorização do usuário, MCP `apply_migration({ name: 'customer_onboarding_registration', query: <conteúdo integral da migração> })`.
3. MCP `execute_sql`: executar os três arquivos SQL transacionais, um por chamada.
4. MCP `get_advisors` para `security` e `performance`.
5. MCP `list_migrations` e confirmar uma única entrada nova.

Expected: todas as suítes pgTAP verdes; `get_customer_details_by_token` sem `search_path` nulo.

- [ ] **Step 3: Commit**

```powershell
rtk git add supabase/tests/database/customer_onboarding_registration.test.sql supabase/migrations/20260715122000_customer_onboarding_registration.sql
rtk git commit -m "feat: complete provisional customer registration"
```

---

### Task 4: Webhook responde também para número novo

**Files:**
- Modify: `supabase/functions/whatsapp-integration/index_test.ts`
- Modify: `supabase/functions/whatsapp-integration/index.ts`

**Interfaces:**
- Consumes: `find_or_create_whatsapp_customer(uuid,text,text)`.
- Produces: resposta Evolution Go `send/text` com `number` normalizado e texto `Para agendar, acesse: {APP_URL}/cliente/{token}/agendar`.

- [ ] **Step 1: RED — trocar o teste existente para a RPC**

No teste `POST /webhook - should reply...`, remover o mock de `rest/v1/customers` e responder a `rest/v1/rpc/find_or_create_whatsapp_customer` com o array completo:

```ts
[{
  customer_id: "customer-123",
  tenant_id: "tenant-456",
  token_acesso: "token-abc",
  cadastro_completo: true,
  created: false,
}]
```

Manter asserções sobre `status`, `sentMessage.number` e link; adicionar asserção de que o texto é exatamente `Para agendar, acesse: https://mock-app.com/cliente/token-abc/agendar`.

Run: `rtk deno test -A supabase/functions/whatsapp-integration/index_test.ts --filter "registered customer message"`

Expected: FAIL; o código atual chama `customers` e inclui saudação/nome.

- [ ] **Step 2: GREEN — substituir varredura pela RPC**

No ramo `isEvolutionGoMessage`:

```ts
const pushName = String(messageInfo.PushName ?? messageInfo.pushName ?? "").trim() || null;
const { data: customerRows, error: customerError } = await supabase.rpc(
  "find_or_create_whatsapp_customer",
  {
    p_tenant_id: instance.tenant_id,
    p_phone: senderPhone,
    p_push_name: pushName,
  },
);
const customer = customerRows?.[0];
if (customerError || !customer?.token_acesso) {
  return new Response(JSON.stringify({ error: "Failed to find or create customer" }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const messageText = `Para agendar, acesse: ${appUrl}/cliente/${customer.token_acesso}/agendar`;
```

Preservar o envio existente e retornar `{ success: true, created: customer.created }`. Não abrir transação em torno do `fetch` externo.

Run: teste filtrado do Step 1.

Expected: PASS.

- [ ] **Step 3: RED — cobrir novo cliente e falhas**

Adicionar testes separados para:

- RPC retorna `created = true`: envia o token novo;
- RPC falha: retorna 500 e não chama `send/text`;
- `send/text` falha: retorna 502;
- `IsFromMe`, `@g.us` e `@broadcast`: retornam `ignored` e não chamam RPC;
- duas mensagens com a mesma resposta RPC enviam o mesmo token.

Cada mock deve representar a resposta HTTP completa: status, `Content-Type` e corpo JSON. As asserções devem observar resposta e mensagem enviada, não contadores internos do mock.

Run: `rtk deno test -A supabase/functions/whatsapp-integration/index_test.ts --filter "POST /webhook"`

Expected: os novos testes falham um por vez até os guards e erros estarem cobertos.

- [ ] **Step 4: GREEN/REFACTOR — extrair somente respostas duplicadas**

Se três ramos repetirem headers JSON, extrair `json(body, status = 200)`. Não extrair regras de domínio do banco para TypeScript.

Run:

```powershell
rtk deno test -A supabase/functions/whatsapp-integration/index_test.ts --filter "POST /webhook"
rtk deno test -A supabase/functions/whatsapp-integration/index_test.ts
```

Expected: testes do webhook verdes; suíte completa sem nova regressão. Falhas preexistentes devem ser registradas separadamente, nunca ocultadas.

- [ ] **Step 5: Commit**

```powershell
rtk git add supabase/functions/whatsapp-integration/index.ts supabase/functions/whatsapp-integration/index_test.ts
rtk git commit -m "feat: reply to new WhatsApp customers"
```

---

### Task 5: Solicitar nome somente no primeiro acesso

**Files:**
- Create: `src/pages/cliente/CadastroInicialCliente.tsx`
- Create: `src/pages/cliente/__tests__/FluxoAgendamento.test.tsx`
- Modify: `src/pages/cliente/FluxoAgendamento.tsx`

**Interfaces:**
- `CadastroInicialClienteProps`: `{ tenantName: string; saving: boolean; onSubmit(name: string): Promise<void> }`.
- `CustomerDetails`: acrescentar `cadastro_completo: boolean`.

- [ ] **Step 1: RED — cadastro incompleto bloqueia catálogo**

Criar teste renderizando `FluxoAgendamento` em `MemoryRouter` com token em `localStorage`. O mock de `supabase.rpc` retorna detalhes incompletos e lança se serviços/profissionais forem solicitados. Verificar:

```ts
expect(await screen.findByRole('heading', { name: 'Antes de agendar' })).toBeInTheDocument();
expect(screen.getByLabelText('Seu nome')).toBeInTheDocument();
expect(screen.queryByText('Selecione o Serviço')).not.toBeInTheDocument();
```

Run: `rtk npm test -- src/pages/cliente/__tests__/FluxoAgendamento.test.tsx`

Expected: FAIL; a página atual ignora `cadastro_completo` e carrega o catálogo.

- [ ] **Step 2: GREEN — criar o portão mínimo**

Implementar `CadastroInicialCliente` como formulário controlado. No submit: `trim`, erro visível `Informe um nome entre 2 e 100 caracteres.`, e chamada de `onSubmit` somente quando válido. Botão usa texto `Salvar e continuar`/`Salvando...` e fica desabilitado durante envio.

Em `FluxoAgendamento`:

- incluir `cadastro_completo` na interface;
- após carregar detalhes incompletos, finalizar loading sem chamar catálogo;
- renderizar `CadastroInicialCliente` antes do fluxo de serviços.

Run: teste do Step 1.

Expected: PASS.

- [ ] **Step 3: RED — nome válido conclui e libera agenda**

Adicionar três testes comportamentais:

1. `A` mantém formulário, mostra validação e não chama `complete_customer_registration`.
2. `  Maria Silva  ` chama RPC com `{ p_token, p_name: 'Maria Silva' }`; resposta completa remove formulário e então carrega serviços/profissionais.
3. Detalhes inicialmente completos pulam formulário e preservam o fluxo atual.

O mock da RPC de conclusão deve retornar a linha completa de `CustomerDetails`, não objeto parcial.

Run: teste do Step 1.

Expected: testes 1 e 2 falham; o fluxo ainda não conclui cadastro.

- [ ] **Step 4: GREEN — integrar conclusão idempotente**

Adicionar `handleCompleteRegistration(name)` que:

1. lê o token existente;
2. chama `complete_customer_registration`;
3. exige uma linha retornada;
4. atualiza `customerDetails` com a resposta;
5. carrega serviços/profissionais somente depois da conclusão;
6. mantém o mesmo token e não navega;
7. em erro, mantém o formulário e mostra toast `Não foi possível salvar seu nome. Tente novamente.`.

Run:

```powershell
rtk npm test -- src/pages/cliente/__tests__/FluxoAgendamento.test.tsx
rtk npm test
rtk npm run build
```

Expected: testes novos e antigos verdes; build sem erro TypeScript.

- [ ] **Step 5: REFACTOR e commit**

Extrair `loadBookingCatalog(token)` para evitar duplicação entre carga inicial completa e conclusão. Não mover RPCs para o componente visual.

```powershell
rtk git add src/pages/cliente/CadastroInicialCliente.tsx src/pages/cliente/__tests__/FluxoAgendamento.test.tsx src/pages/cliente/FluxoAgendamento.tsx
rtk git commit -m "feat: collect customer name before booking"
```

---

### Task 6: Concorrência real e aceitação ponta a ponta

**Files:**
- No new file. This task verifies and deploys the artifacts produced by Tasks 1–5.

**Interfaces:**
- Consumes: MCP Supabase autenticado no projeto `boakqstrdfqmsrwnjore` e artefatos locais já testados.
- Proves: duas chamadas simultâneas produzem um único `customer_id/token_acesso`.

- [ ] **Step 1: Verificar novamente o baseline antes de alterar o remoto**

Usar MCP `execute_sql` para exigir:

- `invalid_phone_count = 0`;
- `duplicate_group_count = 0`;
- as duas novas colunas ainda ausentes antes da primeira migração, ou presentes com definição idêntica em retomada;
- nenhuma migração planejada aparece parcialmente no histórico.

Se qualquer condição divergir, parar. Não reparar ou mesclar dados automaticamente.

- [ ] **Step 2: Aplicar banco somente pelo MCP**

Após testes transacionais verdes e autorização explícita, usar MCP `apply_migration`, em ordem:

1. `customer_onboarding_schema` com o conteúdo de `20260715120000_customer_onboarding_schema.sql`.
2. `customer_onboarding_find_or_create` com o conteúdo de `20260715121000_customer_onboarding_find_or_create.sql`.
3. `customer_onboarding_registration` com o conteúdo de `20260715122000_customer_onboarding_registration.sql`.

Depois de cada chamada, usar MCP `list_migrations` e `execute_sql` com o respectivo teste transacional. Não aplicar a próxima migração se o teste falhar.

- [ ] **Step 3: RED/GREEN de concorrência com duas chamadas MCP reais**

1. MCP `execute_sql`: criar tenant de teste com UUID/e-mail únicos.
2. Disparar simultaneamente duas chamadas MCP `execute_sql`, em conexões independentes, com:

```sql
select * from public.find_or_create_whatsapp_customer(
  '<tenant-de-teste>'::uuid,
  '(92) 99999-7777',
  'Cliente Concorrente'
);
```

3. MCP `execute_sql`: confirmar `count(*) = 1`, mesmo `customer_id/token_acesso` nas duas respostas e flag `cadastro_completo = false`.
4. MCP `execute_sql`: remover tenant de teste; o cascade remove seu cliente.

Expected: as duas chamadas terminam; uma retorna `created = true`, outra `created = false`; existe um único cliente.

- [ ] **Step 4: Publicar Edge Function somente pelo MCP**

Após `rtk deno test -A supabase/functions/whatsapp-integration/index_test.ts`, `rtk npm test` e `rtk npm run build` verdes:

1. MCP `get_edge_function({ function_slug: 'whatsapp-integration' })` e registrar versão/arquivos atuais.
2. MCP `deploy_edge_function` com `name = 'whatsapp-integration'`, `entrypoint_path = 'index.ts'`, conteúdo integral de todos os arquivos locais necessários e `verify_jwt = false`.
3. `verify_jwt = false` é preservado porque a versão ativa já usa esse valor e o webhook Evolution autentica pela identidade/token da instância.
4. MCP `list_edge_functions` e confirmar nova versão ativa.
5. MCP `get_logs({ service: 'edge-function' })` após a primeira chamada de teste e exigir ausência de erro novo.

- [ ] **Step 5: Advisors e aceitação real após deploy autorizado**

Executar MCP `get_advisors` para `security` e `performance`. Confirmar que as novas RPCs têm somente os grants planejados e `search_path` fixo.

Então executar com número ainda não cadastrado:

1. enviar mensagem ao WhatsApp;
2. confirmar recebimento de um único link tokenizado;
3. abrir link e confirmar que só o nome é pedido;
4. salvar nome e concluir um agendamento;
5. reabrir o mesmo link e confirmar entrada direta na agenda;
6. enviar nova mensagem e confirmar reutilização do mesmo token;
7. consultar pelo MCP que existe um único customer completo para tenant+telefone.

## Deployment Gate

Não aplicar migração nem publicar Edge Function até que:

1. todos os RED tenham sido observados e registrados;
2. suítes Deno/Vitest/build locais e testes SQL via MCP estejam verdes;
3. o preflight MCP continue em zero inválidos/duplicados;
4. o usuário autorize explicitamente alteração remota;
5. após deploy, advisors Supabase sejam executados novamente e os novos objetos não tenham grants inesperados.

## Self-Review

- Spec coverage: criação/reuso, normalização, tenant, concorrência, primeiro nome, idempotência, falhas, retorno direto e aceitação real estão mapeados.
- Placeholder scan: nenhum marcador pendente ou passo sem saída esperada.
- Type consistency: as três camadas usam `customer_id`, `tenant_id`, `token_acesso`, `cadastro_completo` e `created`; frontend recebe a linha completa de `CustomerDetails`.
- Supabase review: índice composto atende a consulta exata; transação termina antes do HTTP; RLS permanece ativa; funções definer têm `search_path` fixo e grants mínimos.
- TDD review: cada mudança de comportamento começa por RED observado; mocks ficam apenas nas fronteiras; concorrência usa Postgres real.
