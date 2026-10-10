# 03: Abrir marca como lida, e o Proprietário marca respondida ou não lida

Parte da spec 056 (Contatos do Site no painel do Proprietário).

**What to build:** abrir uma mensagem nova a marca como lida. Abrir uma lida ou respondida não muda nada. A mensagem aberta tem "Marcar como respondido" e "Marcar como não lida", conforme o status atual. A mudança aparece na hora e respeita o filtro (uma mensagem lida sai de Novos). Se a gravação falha, a tela volta ao status anterior e avisa com um toast. A resposta à pessoa continua sendo feita à mão, fora do Navalhado.

Hoje nada altera a coluna `status` do D1: toda mensagem fica `novo`.

**Blocked by:** 02 (Filtros por andamento e mensagens mais antigas)

**Status:** done

- [x] `PATCH /api/admin/contatos/:id` com `{ status }`:
  - aceita só `novo`, `lido` ou `respondido`; fora disso, 422;
  - id inexistente dá 404;
  - devolve o contato atualizado, sem `ip` nem `user_agent`
- [x] Repositório:
  - `abrir` muda para `lido` só o que está `novo`;
  - `marcar` valida o status;
  - os assinantes são avisados depois de cada mudança (o contador do ticket 04 usa esse aviso)
- [x] Hook da lista: a mudança aparece na hora e é desfeita, com toast de erro, quando a gravação falha
- [x] Testes:
  - handler do Worker: `PATCH` válido, 422 e 404;
  - repositório: `abrir` em cada status e aviso aos assinantes;
  - tela: abrir uma nova a tira de Novos, os dois botões, e a falha desfaz a mudança e mostra o toast
- [x] Gates de lint, Vitest e build passam

**Resultado (2026-10-09):**
- `PATCH` grava com `UPDATE ... RETURNING`, numa ida só ao D1; corpo que não é JSON também dá 422, e GET na rota de um contato dá 405.
- Decisão de tela: a mensagem aberta continua visível mesmo que o status novo a tire do filtro, para não sumir no meio da leitura; ela sai da lista quando é fechada (ou quando outra é aberta).
- Erros com motivo próprio (ex.: "Este contato não existe mais.") aparecem no toast; o resto vira "Não foi possível marcar o contato. Tente de novo.".
- Conferido localmente contra o D1 de dev: abrir gravou `lido`, "Marcar como respondido" gravou `respondido`, e "Marcar como não lida" voltou a `novo`. As duas mensagens de teste ficaram `novo`.
