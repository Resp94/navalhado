-- cash_sessions.opened_by/closed_by ja tinham foreign key, mas apontando para
-- auth.users, nao para public.users. O embed `users!opened_by(name)` usado no
-- historico de sessoes de caixa (listarHistorico) resolve "users" para
-- public.users (schema exposto) e o PostgREST nao encontra relacionamento
-- nenhum entre cash_sessions e public.users -- toda chamada falhava com 400 e
-- caia num fallback que nao busca o nome do operador. A coluna "Operador" no
-- Hub Financeiro e o "Operador" do extrato impresso ficavam sempre em
-- branco/generico, em toda sessao de caixa, em todo tenant.
--
-- Sem linhas orfas (opened_by/closed_by apontando para um id que nao existe em
-- public.users) verificado antes desta migracao: seguro adicionar a
-- constraint adicional agora. public.users.id espelha auth.users.id 1:1, entao
-- as duas FKs (para auth.users e para public.users) coexistem sem conflito.
alter table public.cash_sessions
  add constraint cash_sessions_opened_by_public_users_fkey
  foreign key (opened_by) references public.users(id) on delete set null;

alter table public.cash_sessions
  add constraint cash_sessions_closed_by_public_users_fkey
  foreign key (closed_by) references public.users(id) on delete set null;

notify pgrst, 'reload schema';
