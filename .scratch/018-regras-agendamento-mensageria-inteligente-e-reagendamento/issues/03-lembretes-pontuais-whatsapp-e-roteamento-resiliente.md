# 03 — Lembretes Pontuais no Horário do Gerente e Roteamento Resiliente

**What to build:**
A resolução definitiva do disparo de lembretes na Edge Function `whatsapp-integration`: normalizar o roteador de URLs para aceitar caminhos com e sem *trailing slashes* (`/process-reminders` e `/process-reminders/`), processar pontualmente agendamentos confirmados e pendentes de lembrete dentro da janela `reminder_hours` configurada pelo gerente, aplicar a regra de link diário nos lembretes e atualizar `reminder_sent = true` com idempotência.

**Blocked by:** 01 — Migration 055: Slots Canônicos, Origem de Cadastro, Trava de Antecedência e Reagendamento, 02 — Mensageria Inteligente e Link de Primeiro Contato na Edge Function

**Status:** done

- [x] Normalizar `url.pathname` na Edge Function (`path.replace(/\/+$/, "")`) para responder com status 200 nas rotas `/process-reminders` e `/process-return-reminders`.
- [x] Processar agendamentos com `status = 'confirmed'` e `reminder_sent = false` na janela `start_time <= now + reminder_hours`.
- [x] Formatar lembretes utilizando `resolveCustomerMessageWithDailyLink` para garantir o link na 1ª mensagem do dia se necessário.
- [x] Gravar `reminder_sent = true` e registrar chave de idempotência `appointment:${id}:appointment_reminder:${hours}h`.
- [x] Adicionar testes de unidade em `index_test.ts` cobrindo a normalização de rota e o disparo de lembrete em diferentes janelas de tempo.
