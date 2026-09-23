-- Spec 044, ticket 08: autoria do cancelamento protegida contra escrita direta.
--
-- appointments_update_policy deixa o gerente (e o proprietario, via private.is_saas_admin) atualizar
-- qualquer coluna de um Agendamento da propria barbearia -- RLS restringe LINHA, nao coluna. Quem
-- tiver a chave de acesso do gerente pode reescrever canceled_by (autoria) ou cancellation_reason
-- (motivo) direto, sem passar por nenhuma das quatro funcoes de cancelamento.
--
-- REVOKE UPDATE (coluna) ... FROM authenticated, sozinho, nao bastaria: authenticated tinha UPDATE
-- concedido no NIVEL DA TABELA (relacl, GRANT ALL padrao do Supabase), que autoriza UPDATE em
-- qualquer coluna independente de qualquer REVOKE por coluna. A correcao revoga o UPDATE de tabela
-- inteiro e reconcede so nas colunas que nao sao autoria nem motivo -- as outras 16 colunas da
-- tabela. anon e service_role nao sao tocados.
--
-- As quatro funcoes de cancelamento (cancel_appointment_by_manager, cancel_appointment_by_token,
-- cancel_appointment_by_public_session, cancel_comanda_appointment) rodam SECURITY DEFINER como
-- dono da tabela (postgres): o dono ignora GRANT/REVOKE de coluna, entao continuam gravando as duas
-- colunas normalmente. Atualizacoes legitimas do gerente em Agendamento (ex.: notes) nao mudam.
--
-- O Motivo de Cancelamento (cancellation_reason) recebeu a mesma protecao da autoria: nenhuma tela
-- edita esse campo fora das quatro funcoes, e reescreve-lo direto e o mesmo risco -- forjar o
-- registro de por que um Agendamento foi cancelado.

revoke update on public.appointments from authenticated;
grant update (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, created_at, updated_at, reminder_sent, is_fitting, notes, origin, from_waiting_list) on public.appointments to authenticated;
