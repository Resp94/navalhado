-- Spec 044, ticket 09: exclusao de Bloqueio de Horario chega pelo tempo real.
--
-- pgTAP roda dentro de uma transacao desfeita: nao existe commit, entao nao ha como observar aqui
-- a entrega de tempo real em si (ela so acontece via decodificacao logica de mudancas
-- efetivamente commitadas). O que pgTAP prova e o mecanismo estrutural que a corrige: a identidade
-- de replica de blocked_slots passa a ser FULL (a linha antiga inteira viaja no evento de exclusao,
-- inclusive tenant_id, o que o filtro por barbearia da inscricao precisa para casar), e permanece
-- default (so a chave primaria) em appointments, que a aplicacao nunca apaga -- so muda de status,
-- que e UPDATE e ja chega. A verificacao de ponta a ponta (duas sessoes de navegador na mesma
-- barbearia) fica fora do pgTAP; registrada no ticket.

begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is(
  (select relreplident from pg_class where oid = 'public.blocked_slots'::regclass),
  'f',
  'Bloqueio de Horario passa a ter identidade de replica FULL (linha antiga inteira na exclusao)'
);

select is(
  (select relreplident from pg_class where oid = 'public.appointments'::regclass),
  'd',
  'Agendamento continua com identidade de replica padrao (nunca e apagado, so muda de status)'
);

select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'blocked_slots'
  ),
  'Bloqueio de Horario continua publicado para o tempo real'
);

select ok(
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments'
  ),
  'Agendamento continua publicado para o tempo real'
);

select * from finish(true);
rollback;
