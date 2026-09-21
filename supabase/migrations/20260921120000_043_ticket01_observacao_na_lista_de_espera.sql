-- Spec 043, ticket 01: observacao da Lista de Espera volta a ser gravada e lida.
--
-- A gaveta da Lista de Espera coleta uma observacao desde que existe ("so depois
-- das 18h", "quer o Marcos, aceita esperar"), o tipo de dominio declara o campo e
-- o cartao tenta exibi-lo. A coluna nunca existiu: a tabela nasceu sem ela na
-- migracao 015 e nenhuma migracao posterior a acrescentou, entao o adaptador
-- montava a carga de insercao sem o campo e o texto era descartado em silencio.
--
-- Anulavel e sem valor padrao: entrada criada antes desta migracao permanece sem
-- observacao, porque o texto digitado naquela epoca nao existe em lugar nenhum
-- para ser recuperado. Nenhum backfill por heuristica.

alter table public.waiting_list
  add column if not exists notes text;

comment on column public.waiting_list.notes is
  'Observacao livre da recepcao sobre a entrada na Lista de Espera (restricao de horario, preferencia de profissional, contexto do cliente). Viaja para a nota do Agendamento no encaixe de um clique.';
