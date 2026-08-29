# 04 — Corrigir renderização do link e matching do primeiro contato

**What to build:** um fluxo de mensageria em que o template personalizado seja respeitado literalmente e as palavras-chave configuradas pelo tenant sejam as únicas usadas para matching, sem reativação silenciosa de palavras removidas.

**Blocked by:** 03 — Tornar templates e palavras-chave persistentes.

**Status:** done

- [x] Um template personalizado sem `{link}` é enviado sem link anexado automaticamente.
- [x] Um template personalizado com `{link}` interpola o link tokenizado do cliente normalmente.
- [x] Um template ausente continua usando o template padrão correspondente.
- [x] `NULL` e texto vazio em `auto_reply_keywords` não acionam uma lista padrão global.
- [x] Depois de o primeiro contato do dia já estar marcado, uma mensagem contendo `link` não dispara quando `link` foi removido da configuração.
- [x] Normalização de acentos, caixa e espaços continua funcionando sem reintroduzir palavras removidas.
- [x] A política preservada para a primeira mensagem do dia é testada separadamente e documentada na interface, sem mudança silenciosa.
- [x] O ledger diferencia envio, ignorância por regra e falha técnica com motivo sanitizado.
- [x] Confirmação, reagendamento, cancelamento, lembrete, welcome, envio manual, retry, idempotência e contrato UAZAPI continuam funcionando.
- [x] A suíte da Edge Function cobre os casos de template, matching, primeira mensagem e não regressão dos fluxos existentes.

## Result

- O matching agora usa somente as palavras-chave do tenant; `NULL` ou vazio não reativa a lista global.
- O template personalizado é literal: o link só é enviado quando `{link}` está presente; template ausente continua usando o padrão.
- A regra da primeira mensagem do dia foi preservada e testada separadamente.
- O log de ignorância não registra o texto recebido e descreve a regra sem mencionar incorretamente o link.
- O teste integrado cobre cliente já contatado no dia com palavra-chave removida, confirmando que não há novo envio.
- Validação: `index_test.ts` passou com 67 testes.
