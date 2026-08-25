# 01 — Mensageria WhatsApp Limpa e Notificação Direta ao Barbeiro

**What to build:** 
Garantir que todas as mensagens automáticas enviadas via WhatsApp pelo Navalhado (confirmações, reagendamentos e cancelamentos) sejam enviadas sem a caixa/card de pré-visualização de link (`linkPreview: false`), mantendo a mensagem limpa e direta. Adicionalmente, sempre que um novo agendamento for criado (`appointment_created`), o sistema deve identificar o número de telefone do profissional responsável e disparar automaticamente uma mensagem formatada de notificação no WhatsApp pessoal/profissional do barbeiro com idempotência dedicada para evitar duplicações.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Configurar `"linkPreview": false` no payload enviado para o endpoint `/send/text` da Uazapi no provedor neutro de mensageria.
- [ ] Criar o template padrão de notificação para o barbeiro com as variáveis `{profissional}`, `{cliente}`, `{telefone_cliente}`, `{barbearia}`, `{servico}`, `{data}` e `{horario}`.
- [ ] No evento `appointment_created`, disparar a mensagem para o número do profissional com chave de idempotência dedicada (`appointment:<id>:professional_appointment_created`).
- [ ] Adicionar testes automatizados cobrindo a supressão do linkPreview e o envio duplo com idempotência.
