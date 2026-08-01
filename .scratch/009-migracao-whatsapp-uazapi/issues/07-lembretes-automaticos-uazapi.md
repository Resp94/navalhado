# 07 — Migrar os lembretes automáticos

**What to build:** Fazer a rotina periódica continuar encontrando Agendamentos confirmados no momento devido e enviar seus lembretes pela Instância WhatsApp da Uazapi, preservando antecedência, tenant, fuso e proteção contra duplicidade.

**Blocked by:** 06 — Enviar mensagens imediatas com resiliência.

**Status:** ready-for-agent

- [ ] A rotina mantém a periodicidade e os critérios atuais de seleção de lembretes.
- [ ] Somente Agendamentos confirmados, ainda não lembrados e pertencentes a integração conectada são processados.
- [ ] A antecedência configurada pelo Gerente continua entre os limites existentes.
- [ ] Texto, data e hora respeitam o Fuso Horário da Barbearia.
- [ ] O envio usa o mesmo pipeline resiliente das mensagens imediatas.
- [ ] Cada lembrete devido possui uma chave de idempotência estável.
- [ ] Um lembrete somente é marcado como enviado após resultado confirmado.
- [ ] Falhas temporárias permitem novas tentativas sem duplicidade.
- [ ] Falhas permanentes ficam diagnosticáveis e não entram em repetição infinita.
- [ ] A rotina de uma Barbearia não acessa a instância ou Agendamentos de outra.
- [ ] Testes cobrem seleção, preferências, sucesso, falha, repetição e isolamento por tenant.

