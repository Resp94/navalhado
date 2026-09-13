# 05: Extrato impresso da Sessão de Caixa com todas as saídas

**What to build:** o gestor imprime o extrato de uma Sessão de Caixa e o papel passa a explicar a
gaveta inteira. Hoje o extrato agrupa movimentos por nomes fixos e omite o vale de profissional: o
vale sai da gaveta, entra no valor esperado e não aparece na folha, então o papel não fecha com a
contagem.

O contrato de leitura do extrato passa a devolver, em cada movimento, o sentido materializado no
ticket 01 e os vínculos que já existem na linha. O extrato agrupa por tipo com rótulo conhecido e,
quando encontra um tipo sem rótulo, cai num rótulo genérico pelo sentido em vez de omitir a linha.
Assim, nenhum tipo futuro volta a sumir do papel em silêncio. O pagamento de conta ganha rótulo
próprio no ticket 15.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 1 — Apuração única do valor esperado da
gaveta" (extrato impresso).

**Blocked by:** 01 — Expand: apuração única do valor esperado da gaveta no servidor;
035/02 — Hub Financeiro em sub-rotas.

**Status:** done

- [x] O contrato de leitura do extrato da Sessão de Caixa devolve, em cada movimento, o sentido e
      os vínculos já existentes na linha, com chaves aditivas e sem mudar assinatura.
- [x] O extrato impresso lista o vale de profissional com rótulo próprio.
- [x] Um movimento de tipo sem rótulo conhecido aparece com rótulo genérico de entrada ou saída,
      conforme o sentido, e nunca é omitido.
- [x] A soma das linhas impressas explica o valor esperado da sessão (história 5).
- [x] A suíte pgTAP `22_extrato_sessao_caixa` continua verde, cobrindo as chaves novas — via MCP
      (18/18 assertions).
- [x] O teste de página existente do extrato ganha caso com vale.
- [x] `npm run test` e `npm run test:db` verdes — `npm run test:db` cumprido via MCP (suíte 22).

**Notas de implementação:**

- `get_cash_session_statement` (migration
  `supabase/migrations/20260913160000_extrato_sessao_caixa_sentido_e_vinculos.sql`) passa a
  devolver, em cada item de `movements`, as chaves aditivas `direction`
  (`'entrada' | 'saida'`, espelhando `cash_movements.direction` do ticket 01) e `professional_id`
  (vínculo já existente na linha do vale). Nenhuma chave existente mudou; assinatura e
  revoke/grant permanecem os mesmos.
- `src/modules/caixa/types.ts`: `CashSessionMovementEntry` ganhou os campos `direction` (não
  opcional, pois a coluna do banco é `not null`) e `professional_id`. Ninguém mais no módulo
  precisou mudar — a leitura já passava o JSON adiante sem mapear campo a campo.
- `src/components/caixa/ExtratoSessaoCaixaModal.tsx`: as quatro seções fixas (suprimento, sangria,
  repasse de comissão, vale de profissional) agora nascem de uma única lista `MOVEMENT_SECTIONS`
  (tipo, rótulo, título da seção, mensagem de vazio) — rótulo e apresentação vêm do mesmo item, de
  propósito, para que um tipo novo não possa ganhar rótulo sem ganhar seção (ou vice-versa) por
  descuido, o mesmo defeito que este ticket corrige para o vale. Um tipo fora dessa lista cai na
  seção "Outras movimentações", com rótulo genérico `'Outra entrada'`/`'Outra saída'` pelo campo
  `direction` quando não há `reason`. O ticket 15 (pagamento de conta) deve adicionar seu tipo a
  `MOVEMENT_SECTIONS` para ganhar seção própria, ou aceitar o rótulo genérico até lá.
- `supabase/tests/database/22_extrato_sessao_caixa.test.sql`: plano subiu de 15 para 18. O
  contexto sintético ganhou um profissional e um segundo movimento (`vale_profissional`,
  vinculado ao profissional) ao lado do repasse já existente. As nova asserções usam
  `jsonb_array_elements(...) where m->>'type' = ...` em vez de índice fixo no array, porque os
  dois movimentos são inseridos na mesma transação de teste e podem empatar em `created_at`
  (timestamp de transação), o que tornaria um `movements->0` frágil.
- `src/pages/gerente/__tests__/Financeiro.test.tsx`: o teste de impressão do extrato ganhou um
  movimento de vale (rótulo próprio) e um tipo inventado (`ajuste_futuro`, sem `reason`) para
  provar o rótulo genérico por sentido.
