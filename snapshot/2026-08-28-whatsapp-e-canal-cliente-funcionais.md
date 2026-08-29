# Snapshot operacional — WhatsApp e Canal do Cliente funcionais

**Data:** 28/08/2026 22:57 (America/Manaus)  
**Referências:** `44b9f36`, `1af3b21`, `eac845f`.  
**Working tree:** alteração documental pendente de commit.

## ✅ Funcional

### Canal do Cliente

- Links públicos tokenizados validam o cliente e abrem o painel sem falso erro de token.
- Criação, consulta, cancelamento e reagendamento respeitam o token, tenant, disponibilidade e regras de prazo.
- Reagendamento pelo link público persiste o novo horário e gera o evento correspondente no outbox.

### Todos os envios WhatsApp

Todos os fluxos de envio WhatsApp implementados estão funcionais, não somente o reagendamento:

- boas-vindas de novos clientes;
- primeiro contato do dia;
- respostas por palavras-chave;
- confirmação de agendamento;
- cancelamento de agendamento;
- reagendamento de agendamento;
- lembretes periódicos;
- envio manual pelo painel.

Os fluxos utilizam o dispatcher comum, outbox durável, retry e idempotência conforme o snapshot `2026-08-28-mensageria-review-hardening.md`. A Edge Function `whatsapp-integration` permanece publicada e os testes específicos de mensageria foram aprovados.

## Evidências

- Suíte de mensageria: **72 testes aprovados**.
- Suíte geral do frontend: **53 arquivos e 291 testes aprovados**.
- Evento real de reagendamento: `appointment_rescheduled` processado pelo outbox com status `succeeded`.
- Triggers, isolamento por tenant e contratos UAZAPI preservados.

## Regras críticas de preservação

- Não alterar o contrato de envio da UAZAPI.
- Manter todos os eventos WhatsApp no dispatcher e no outbox durável.
- Preservar retry, idempotência, opt-out e observabilidade sanitizada.
- Toda alteração de banco deve ser feita em nova migration versionada.

## Validações

- `npm test` — **291 aprovados**.
- Testes da Edge Function WhatsApp — **72 aprovados**.
- `npm run build` — **aprovado**.
- `npm run lint` — **código 0**, somente avisos preexistentes.
- `git diff --check` — **aprovado**.
