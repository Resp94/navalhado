# 07 — Migrar os lembretes automáticos

**What to build:** Fazer a rotina periódica continuar encontrando Agendamentos confirmados no momento devido e enviar seus lembretes pela Instância WhatsApp da Uazapi, preservando antecedência, tenant, fuso e proteção contra duplicidade.

**Blocked by:** 06 — Enviar mensagens imediatas com resiliência.

**Status:** completed

- [x] A rotina mantém a periodicidade e os critérios atuais de seleção de lembretes.
- [x] Somente Agendamentos confirmados, ainda não lembrados e pertencentes a integração conectada são processados.
- [x] A antecedência configurada pelo Gerente continua entre os limites existentes.
- [x] Texto, data e hora respeitam o Fuso Horário da Barbearia.
- [x] O envio usa o mesmo pipeline resiliente das mensagens imediatas.
- [x] Cada lembrete devido possui uma chave de idempotência estável.
- [x] Um lembrete somente é marcado como enviado após resultado confirmado.
- [x] Falhas temporárias permitem novas tentativas sem duplicidade.
- [x] Falhas permanentes ficam diagnosticáveis e não entram em repetição infinita.
- [x] A rotina de uma Barbearia não acessa a instância ou Agendamentos de outra.
- [x] Testes cobrem seleção, preferências, sucesso, falha, repetição e isolamento por tenant.
