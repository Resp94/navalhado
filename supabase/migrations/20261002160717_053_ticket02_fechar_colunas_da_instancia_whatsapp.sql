-- Spec 053, ticket 02 (passo 1): o navegador le e grava whatsapp_instances so pelas colunas da tela.
--
-- instance_token e a credencial da instancia na Uazapi (envia mensagem, recebe o webhook, conecta, desconecta e
-- exclui a instancia), e a ADR 010 (decisao 4) manda guarda-lo "somente para uso server-side". A migration 009
-- tinha fechado a leitura e a escrita dele por coluna. A 036 e a 051 concederam SELECT e UPDATE na TABELA inteira
-- a authenticated, e o privilegio de tabela vale para todas as colunas: nenhum REVOKE por coluna o tira. Desde
-- entao o Gerente da barbearia e o Proprietario leem e regravam instance_token, instance_name,
-- provider_instance_id e environment pela API de dados, e o token viaja no WebSocket do Realtime. RLS restringe
-- linha, nao coluna.
--
-- Mesmo idioma da migration 044 (appointments): revoga o privilegio de tabela inteira e reconcede so as colunas
-- permitidas. O revoke de tabela tambem apaga os privilegios de coluna que a 009 e a 023 deixaram, entao o
-- resultado nao depende do estado de partida (a PROD pode ter residuos diferentes dos do DEV). anon fica sem nada.
-- service_role, RLS, policies, publicacao do Realtime e REPLICA IDENTITY nao sao tocados.
--
-- Leitura: as 20 colunas que a tela usa (WHATSAPP_INSTANCE_COLUMNS). id e tenant_id ficam porque o Realtime
-- exige SELECT na chave primaria (sem ele responde 401) e o filtro da assinatura usa tenant_id.
-- Escrita: as 16 de configuracao (cinco de envio, nove modelos, palavras-chave e updated_at) mais status e
-- qr_code, que a tela atual ainda grava ao conectar e desconectar. O ticket 04 (passo 2) revoga essas duas:
--   revoke update (status, qr_code) on public.whatsapp_instances from authenticated;
-- Ficam fechadas ao navegador: instance_token, provider_instance_id, provider, environment e created_at (leitura
-- e escrita) e id, tenant_id e instance_name (escrita).
--
-- Convencao: coluna nova de whatsapp_instances nasce fechada. Para a tela le-la, a migration que a cria concede
-- "grant select (coluna)" e, para grava-la, "grant update (coluna)". Um erro 42501 se corrige concedendo a COLUNA
-- certa, nunca a tabela. O pgTAP 77 e o guarda, com a lista exata de colunas.

revoke all on table public.whatsapp_instances from anon, authenticated;

grant select (
  id, tenant_id, instance_name, qr_code, status,
  send_confirmation, send_reminders, send_cancellation, send_welcome_balcao, reminder_hours,
  template_confirmation, template_reschedule, template_cancellation, template_reminder,
  template_welcome_balcao, template_first_contact,
  template_professional_created, template_professional_rescheduled, template_professional_cancelled,
  auto_reply_keywords
) on public.whatsapp_instances to authenticated;

grant update (
  qr_code, status,
  send_confirmation, send_reminders, send_cancellation, send_welcome_balcao, reminder_hours,
  template_confirmation, template_reschedule, template_cancellation, template_reminder,
  template_welcome_balcao, template_first_contact,
  template_professional_created, template_professional_rescheduled, template_professional_cancelled,
  auto_reply_keywords,
  updated_at
) on public.whatsapp_instances to authenticated;
