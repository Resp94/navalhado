# Snapshot operacional — Spec 025: mensageria, encaixes e comanda

**Data da validação:** 30/08/2026 (America/Manaus)  
**Ambiente funcional:** DEV — `https://dev.navalhado.com.br`  
**Commit de código validado:** `8aae549` (`dev`)  
**Migration validada:** `088_skip_past_fitting_confirmations`  
**Status:** funcional e validado com testes automatizados, navegador integrado e persistência no banco DEV

## Escopo confirmado

- Encaixes em horários passados continuam permitidos no fluxo interno.
- Encaixes passados ficam restritos ao encaixe de balcão e não geram confirmação de WhatsApp.
- A proteção ocorre antes do outbox; não há disparo para cliente ou profissional.
- O motivo da supressão é registrado para observabilidade, sem expor telefone, token ou secret.
- Encaixes futuros preservam o fluxo normal de confirmação.
- O card mantém a identificação `Encaixe` enquanto está pendente.
- O selo `Pago` isolado não é suficiente para deixar o card totalmente verde.
- O card fica totalmente verde somente após a comanda ser finalizada e o atendimento ficar concluído.
- A confirmação de agendamento apresenta serviço, duração e valor formatado em BRL.
- A Agenda é atualizada após a finalização da comanda.

## Validação automatizada

- Testes direcionados do frontend: `48` aprovados.
- Testes da Edge Function de WhatsApp: `72` aprovados.
- Build de produção: concluído com sucesso.
- Lint: concluído com os avisos históricos já conhecidos.

## Validação visual no DEV

A validação foi realizada no navegador integrado, em desktop e mobile, sem acessar produção:

- Link público: somente horários disponíveis, com último slot em `18:20` e sem `18:40`.
- Confirmação pública: serviço, duração e valor apresentados corretamente.
- Agenda interna: grade preservada até `18:20`.
- Encaixe passado de `29/08/2026 às 16:40`: criado com sucesso e sem confirmação de WhatsApp.
- Encaixe pago de `29/08/2026 às 17:20`: comanda finalizada, card totalmente verde e selos `Encaixe` e `Pago` preservados.

### Prints registrados

- [Slots públicos desktop](../verificacoes/evidencias/025/01-slots-publicos-desktop.png)
- [Slots públicos mobile](../verificacoes/evidencias/025/02-slots-publicos-mobile.png)
- [Confirmação com valor mobile](../verificacoes/evidencias/025/03-confirmacao-valor-mobile.png)
- [Confirmação com valor desktop](../verificacoes/evidencias/025/04-confirmacao-valor-desktop.png)
- [Agenda e grade desktop](../verificacoes/evidencias/025/05-agenda-grade-desktop.png)
- [Último slot em 18:20](../verificacoes/evidencias/025/06-agenda-ultimo-slot-18-20.png)
- [Agenda e grade mobile](../verificacoes/evidencias/025/07-agenda-grade-mobile.png)
- [Encaixe passado confirmado](../verificacoes/evidencias/025/08-encaixe-passado-confirmado.png)
- [Encaixe pago com card verde](../verificacoes/evidencias/025/09-encaixe-pago-verde.png)

## Persistência no banco DEV

### Encaixe passado

- `is_fitting=true` e `status=confirmed`.
- `whatsapp_message_outbox`: `0` registros.
- `whatsapp_message_idempotency`: `0` registros.
- `audit_logs`: `1` registro com `action=whatsapp_confirmation_suppressed` e `reason=past_fitting_confirmation`.

### Encaixe pago

- Horário local validado: `29/08/2026 às 17:20`.
- `is_fitting=true`.
- `status=completed`.
- `payment_status=paid`.
- `whatsapp_message_outbox`: `0` registros.
- `whatsapp_message_idempotency`: `0` registros.
- `audit_logs`: `1` registro de supressão da confirmação passada.

Nenhuma mensagem real foi enviada durante os testes.

## Migrations e segurança

- A migration `088` foi aplicada e verificada exclusivamente no banco DEV via MCP.
- Nenhuma alteração foi realizada em produção.
- Segredos, tokens e telefones completos não foram incluídos nas evidências ou neste snapshot.
- Os avisos históricos dos advisors do Supabase permanecem fora do escopo desta Spec 025.

## Referências

- [Spec 025](../specs/025-mensageria-encaixes/spec.md)
- [Relatório de validação DEV](../verificacoes/025-validacao-dev-2026-08-30.md)
