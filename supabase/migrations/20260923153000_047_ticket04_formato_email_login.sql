-- Spec 047, ticket 04: formato rigido de e-mail nos logins (gerente e
-- barbeiro).
--
-- CHECK em users.email com a funcao unica public.email_valido (ticket 01).
-- E-mail de login mal formado passa a ser recusado mesmo em cadastro feito
-- direto pela API, sem passar pela tela.

alter table public.users
  add constraint users_email_format_check
  check (public.email_valido(email))
  not valid;

alter table public.users
  validate constraint users_email_format_check;
