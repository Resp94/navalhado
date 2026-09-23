-- Spec 047, ticket 01: formato rigido de e-mail no cadastro de Cliente.
--
-- Cria a funcao unica de validacao de formato de e-mail, reaproveitada por
-- todos os tickets seguintes da spec 047 (Fornecedor, tenants, users), e
-- aplica o primeiro CHECK, em customers.email. A mesma regra existe no
-- front (src/lib/email.ts) e, mais adiante, na Edge Function de Acesso do
-- barbeiro -- os tres lugares precisam ficar em sincronia.
--
-- Regra: parte local sem ponto no inicio, no fim ou duplicado; dominio com
-- rotulos alfanumericos (hifen so no meio do rotulo) e TLD de 2+ letras.
-- Maiusculas e minusculas indiferentes (~*).

create or replace function public.email_valido(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_email ~* '^[a-z0-9_%+-]+(\.[a-z0-9_%+-]+)*@([a-z0-9]+(-+[a-z0-9]+)*\.)+[a-z]{2,}$'
$$;

comment on function public.email_valido(text) is
  'Formato de e-mail (spec 047): mesma regra do front (src/lib/email.ts) e da Edge Function de Acesso do barbeiro. Confere so o formato, nunca se o dominio existe ou recebe e-mail.';

alter table public.customers
  add constraint customers_email_format_check
  check (email is null or public.email_valido(email))
  not valid;

alter table public.customers
  validate constraint customers_email_format_check;
