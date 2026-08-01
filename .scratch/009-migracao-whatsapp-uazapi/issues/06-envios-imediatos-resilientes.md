# 06 — Enviar mensagens imediatas com resiliência

**What to build:** Migrar confirmação, cancelamento e envio de teste para o endpoint de texto da Uazapi, preservando preferências, conteúdo e Fuso Horário da Barbearia. Envios automáticos devem ser idempotentes e recuperar falhas temporárias sem criar spam.

**Blocked by:** 03 — Ativar uma instância pela Uazapi.

**Status:** completed

- [x] Confirmações habilitadas são enviadas pela Instância WhatsApp do tenant correto.
- [x] Cancelamentos habilitados são enviados pela Instância WhatsApp do tenant correto.
- [x] Configurações desabilitadas impedem o respectivo envio.
- [x] O envio de teste usa o mesmo gateway e apresenta o resultado ao Gerente.
- [x] Números são enviados no formato E.164 brasileiro sem máscara.
- [x] Datas e horários respeitam o Fuso Horário da Barbearia.
- [x] Cada Evento de Agendamento possui chave de idempotência estável.
- [x] Reentregas ou novas tentativas não duplicam mensagens concluídas.
- [x] Timeout, erro de rede, HTTP 429 e respostas 5xx permitem no máximo três tentativas graduais.
- [x] `Retry-After` é respeitado quando informado.
- [x] Erros 4xx permanentes não são repetidos.
- [x] Resultado final e quantidade de tentativas ficam disponíveis para diagnóstico sem expor tokens.
- [x] Testes cobrem preferências, conteúdo, fuso, idempotência, repetição temporária e falha permanente.
