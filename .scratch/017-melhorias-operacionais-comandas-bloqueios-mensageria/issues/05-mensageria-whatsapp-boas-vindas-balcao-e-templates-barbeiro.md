# 05 — Mensageria WhatsApp: Boas-Vindas de Balcão e Templates da Equipe

**What to build:** Implementar o envio automático e configurável de boas-vindas com link de autoatendimento exclusivo para clientes novos cadastrados no balcão (`registration_origin = 'balcao'`, com blindagem contra reenvio em edição), além de tornar as notificações da equipe (novo agendamento, reagendamento e cancelamento) 100% personalizáveis pelo gestor em `/whatsapp` e livres do contato pessoal do cliente.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Criar e aplicar migration adicionando `registration_origin TEXT NOT NULL DEFAULT 'balcao'` e `welcome_sent_at TIMESTAMPTZ` na tabela `public.customers`.
- [ ] Adicionar colunas `template_welcome_balcao`, `send_welcome_balcao`, `template_professional_created`, `template_professional_rescheduled` e `template_professional_cancelled` na tabela `public.whatsapp_instances`.
- [ ] Criar trigger `trg_customer_welcome_balcao` disparada exclusivamente no INSERT de clientes com `registration_origin = 'balcao'` e telefone válido.
- [ ] Atualizar a Edge Function `supabase/functions/whatsapp-integration/index.ts` para processar o evento `customer_welcome_balcao` e registrar `welcome_sent_at`.
- [ ] Remover `{telefone_cliente}` dos modelos padrão enviados aos profissionais e permitir que o gestor personalize esses templates.
- [ ] Adicionar a aba **"Boas-vindas"** e a seção de **"Notificações da Equipe"** no editor split-view e simulador de `/whatsapp`.
- [ ] Garantir que o cadastro manual no modal de `Clientes.tsx` defina `registration_origin: 'balcao'` e que edições posteriores (UPDATE) não disparem nova mensagem de boas-vindas.
- [ ] Atualizar testes em `Whatsapp.test.tsx` e `Clientes.test.tsx`.
