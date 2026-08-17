# 02 — Disparos Automáticos e Webhook de Entrada com Templates Customizados

**What to build:** 
A integração da mensageria em produção para que todos os disparos automáticos de agendamentos e respostas de primeiro contato utilizem as mensagens customizadas gravadas no banco de dados para a barbearia, com garantia absoluta de fallback não-quebrante. Ao ocorrerem eventos de criação de agendamento (`appointment_created`), reagendamento (`appointment_rescheduled`), cancelamento (`appointment_cancelled`), processamento de lembretes periódicos (`/process-reminders`) ou recebimento de mensagem no WhatsApp bot (`inbound` / primeiro contato), o gateway consulta as novas colunas da instância, formata o texto com as variáveis contextuais e dispara via Uazapi Provider preservando a idempotência e regras de repetição existentes.

**Blocked by:** 01 — Infraestrutura de Dados e Motor de Fallback Seguro de Mensagens

**Status:** ready-for-agent

- [ ] Consulta da instância WhatsApp em `/send-notification` recuperando `template_confirmation`, `template_reschedule` e `template_cancellation`.
- [ ] Formatação da mensagem com substituição de tags dinâmicas nos 3 eventos de agendamento com fallback garantido para textos de fábrica se o template for nulo.
- [ ] Consulta da instância WhatsApp em `/process-reminders` recuperando `template_reminder` e disparando o lembrete personalizado no horário correto.
- [ ] Consulta da instância WhatsApp no webhook de primeiro contato (`inbound`) recuperando `template_first_contact` e respondendo ao novo cliente com o link personalizado.
- [ ] Idempotência de envio preservada sem duplicidades em todos os cenários.
- [ ] Testes automatizados cobrindo a formatação e o envio de notificações com templates customizados e com templates vazios (fallback).
