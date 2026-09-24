-- Gerente incluido como barbeiro no onboarding fica vinculado ao proprio login.
--
-- O wizard de onboarding ("Me incluir como Barbeiro") gravava o profissional
-- do gerente com user_id nulo. Assim ele aparecia em "Criar acesso" como
-- barbeiro sem login. O wizard passa a gravar o user_id do gerente; esta
-- migration corrige as barbearias ja criadas.
--
-- O onboarding nao guardava qual profissional era o gerente, entao o vinculo
-- e feito pelo nome: gerente ativo e profissional da mesma barbearia, com o
-- mesmo nome, profissional sem login e nao excluido. So vincula quando o par
-- e unico dos dois lados e o gerente ainda nao tem profissional vinculado.

with candidatos as (
  select
    u.id as user_id,
    p.id as professional_id,
    count(*) over (partition by u.id) as por_gerente,
    count(*) over (partition by p.id) as por_profissional
  from public.users u
  join public.professionals p
    on p.tenant_id = u.tenant_id
   and lower(btrim(p.name)) = lower(btrim(u.name))
  where u.role = 'gerente'
    and u.is_active
    and p.user_id is null
    and p.deleted_at is null
    and not exists (select 1 from public.professionals x where x.user_id = u.id)
)
update public.professionals p
set user_id = c.user_id
from candidatos c
where p.id = c.professional_id
  and c.por_gerente = 1
  and c.por_profissional = 1;
