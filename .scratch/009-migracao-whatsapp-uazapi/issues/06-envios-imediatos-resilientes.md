# 06 — Enviar mensagens imediatas com resiliência

**What to build:** Migrar confirmação, cancelamento e envio de teste para o endpoint de texto da Uazapi, preservando preferências, conteúdo e Fuso Horário da Barbearia. Envios automáticos devem ser idempotentes e recuperar falhas temporárias sem criar spam.

**Blocked by:** 03 — Ativar uma instância pela Uazapi.

**Status:** ready-for-agent

- [ ] Confirmações habilitadas são enviadas pela Instância WhatsApp do tenant correto.
- [ ] Cancelamentos habilitados são enviados pela Instância WhatsApp do tenant correto.
- [ ] Configurações desabilitadas impedem o respectivo envio.
- [ ] O envio de teste usa o mesmo gateway e apresenta o resultado ao Gerente.
- [ ] Números são enviados no formato E.164 brasileiro sem máscara.
- [ ] Datas e horários respeitam o Fuso Horário da Barbearia.
- [ ] Cada Evento de Agendamento possui chave de idempotência estável.
- [ ] Reentregas ou novas tentativas não duplicam mensagens concluídas.
- [ ] Timeout, erro de rede, HTTP 429 e respostas 5xx permitem no máximo três tentativas graduais.
- [ ] `Retry-After` é respeitado quando informado.
- [ ] Erros 4xx permanentes não são repetidos.
- [ ] Resultado final e quantidade de tentativas ficam disponíveis para diagnóstico sem expor tokens.
- [ ] Testes cobrem preferências, conteúdo, fuso, idempotência, repetição temporária e falha permanente.

