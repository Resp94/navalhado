# Validação DEV — Spec 025

Data: 30/08/2026  
Ambiente: `https://dev.navalhado.com.br`  
Data validada: 31/08/2026

## Evidências visuais

1. Link público em desktop: horários disponíveis exibidos de `10:40` a `18:20`; `18:40` não é exibido.
2. Link público em mobile: mesma regra de disponibilidade, com o último slot em `18:20`.
3. Confirmação em mobile: serviço, duração (`40 minutos`), valor (`R$ 50,00`) e horário (`18:20`) apresentados.
4. Confirmação em desktop: mesmos dados apresentados de forma responsiva.
5. Agenda interna em desktop: grade do profissional preservada, incluindo `18:20`.
6. Parte final da agenda: `16:20`, `17:00`, `17:40` e `18:20`, sem slot posterior.
7. Agenda interna em mobile: agendamento existente separado dos horários vagos, com `18:20` como último slot.
8. Encaixe passado confirmado na Agenda: operação concluída sem abrir confirmação de WhatsApp.
9. Encaixe pago em `17:20`: card totalmente verde, mantendo os selos `Encaixe` e `Pago`.

## Arquivos

- [01 — slots públicos desktop](evidencias/025/01-slots-publicos-desktop.png)
- [02 — slots públicos mobile](evidencias/025/02-slots-publicos-mobile.png)
- [03 — confirmação com valor mobile](evidencias/025/03-confirmacao-valor-mobile.png)
- [04 — confirmação com valor desktop](evidencias/025/04-confirmacao-valor-desktop.png)
- [05 — agenda e grade desktop](evidencias/025/05-agenda-grade-desktop.png)
- [06 — último slot 18:20](evidencias/025/06-agenda-ultimo-slot-18-20.png)
- [07 — agenda e grade mobile](evidencias/025/07-agenda-grade-mobile.png)
- [08 — encaixe passado confirmado](evidencias/025/08-encaixe-passado-confirmado.png)
- [09 — encaixe pago com card verde](evidencias/025/09-encaixe-pago-verde.png)

## Persistência e mensageria no banco DEV

- Encaixe passado de `16:40` em `29/08/2026`: `status=confirmed`, `is_fitting=true`, sem registro no outbox e com auditoria `past_fitting_confirmation`.
- Encaixe pago de `17:20` em `29/08/2026`: `status=completed`, `payment_status=paid`, `is_fitting=true`.
- Para o encaixe pago: `whatsapp_message_outbox=0`, `whatsapp_message_idempotency=0` e uma auditoria de supressão.
- Nenhuma mensagem foi enviada ao cliente ou ao profissional.

## Resultado

- Foram realizados dois encaixes controlados no DEV exclusivamente para validar a supressão de mensagens e o estado visual do card.
- O segundo encaixe teve a comanda aberta com troco inicial de `R$ 0,00` e foi finalizado via PIX para validar o estado pago.
- A migration `088` e o trigger de mensageria foram verificados previamente no banco DEV via MCP.
