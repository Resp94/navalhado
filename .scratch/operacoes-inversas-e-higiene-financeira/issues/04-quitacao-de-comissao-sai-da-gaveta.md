# 04 — Quitação de Comissão sai da gaveta

**What to build:** O gerente paga a comissão de um barbeiro em dinheiro e o sistema reconhece que aquele dinheiro saiu da gaveta: a quitação exige uma Sessão de Caixa aberta, registra a saída correspondente com tipo próprio de movimentação, e o Fechamento de Caixa com Conferência passa a subtrair esse valor do saldo esperado. Repasse em PIX, transferência ou cartão continua sem tocar o caixa físico.

**Blocked by:** 01 — Suíte de banco confiável; 02 — Histórico de migrations reconciliado; 03 — Módulo profundo de comissões.

**Status:** done — migration aplicada no DEV, pgTAP e vitest verdes

- [x] Consultar pelo MCP a definição vigente das funções de quitação e de fechamento e os tipos aceitos de movimentação de caixa no DEV.
- [x] Criar migration nova acrescentando o tipo próprio de movimentação para repasse de comissão, sem reaproveitar sangria.
- [x] Acrescentar à quitação o parâmetro de Sessão de Caixa, obrigatório quando o método é dinheiro e recusado quando não é.
- [x] Recusar com erro de domínio sessão inexistente, encerrada ou de outra unidade.
- [x] Gerar a movimentação de caixa vinculada à quitação que a originou, e guardar na quitação o vínculo com a sessão em que foi paga.
- [x] Fazer o fechamento subtrair as quitações em dinheiro do turno no cálculo do valor esperado, ao lado das sangrias.
- [x] Incrementar a versão de cálculo gravada na sessão, para que fechamentos anteriores continuem interpretáveis pela fórmula que os produziu.
- [x] Cobrir por pgTAP: quitação em dinheiro sem turno aberto recusada; com turno aberto gerando movimentação do tipo próprio; métodos não-dinheiro sem sessão e sem movimentação; fechamento apurando a divergência real.
- [x] Refletir o parâmetro novo no contrato do módulo de comissões e cobrir a validação de entrada.
- [x] Aplicar no DEV pelo MCP e comparar advisors de segurança e performance antes e depois.
- [x] Manter verdes as suítes atuais de Caixa, Financeiro e quitação.

## Notas de execução

- Migrations `20260912000001_quitacao_comissao_gaveta_caixa` e
  `20260912000002_remove_overload_legado_quitacao_comissao` aplicadas no DEV
  (selvxobcjbkligxighlp) via MCP, com a versão reconciliada para bater com o
  nome do arquivo local, conforme decisão do ticket 02.
- Achado durante a aplicação: `create or replace function` com um parâmetro
  novo por padrão cria uma SEGUNDA sobrecarga em vez de substituir a função
  existente quando a contagem de parâmetros muda — o Postgres só reaproveita
  a mesma função quando os tipos de parâmetro batem exatamente. A sobrecarga
  antiga de 6 parâmetros ficou órfã no catálogo e a nova de 7 nasceu com o
  grant padrão de `PUBLIC` (portanto `anon`), já que `CREATE OR REPLACE` só
  preserva grants quando é literalmente a mesma função. A segunda migration
  remove a sobrecarga antiga e realinha os grants (`authenticated` e
  `service_role` apenas) ao padrão do restante do módulo financeiro.
- Testes de caracterização e comportamentais atualizados para a assinatura
  de 7 parâmetros: `11_quitacoes_obrigacoes`, `15_reconciliacao_desempenho`,
  `17_code_review_regressions`, `financeiro_estoque_baseline`. O ticket 04
  (`04_proteger_quitacao_comissoes.test.sql`) trocou seu teste de quitação
  "total" de `cash` para `transfer`, já que esse teste não tem sessão de
  caixa no contexto e não é sobre o fluxo de gaveta (coberto pelo novo
  arquivo `19_quitacao_comissao_gaveta_caixa.test.sql`).
- Novo arquivo `supabase/tests/database/19_quitacao_comissao_gaveta_caixa.test.sql`
  (14 asserções) cobre: exigência de sessão para dinheiro, rejeição de
  sessão para métodos não-dinheiro, geração da movimentação `repasse_comissao`
  vinculada à quitação, ausência de movimentação para métodos não-dinheiro,
  rejeição de sessão encerrada, e o fechamento de caixa descontando o
  repasse do valor esperado (`calculation_version = 'cash_expected_v2'`).
- Frontend: `src/modules/comissoes` ganhou `cash_session_id` opcional no
  contrato, com validação cruzada (obrigatório para `cash`, proibido para os
  demais métodos) espelhando a regra do banco. `QuitacaoComissaoModal` recebe
  `activeCashSessionId` do `Financeiro.tsx` (a sessão de caixa aberta do
  turno), desabilita a opção "Dinheiro em espécie" no seletor quando não há
  caixa aberto e bloqueia o envio com mensagem de domínio antes de chamar o
  banco.
- Advisors de segurança e performance comparados antes e depois: nenhum
  alerta novo além do esperado (dois índices novos aparecem como "unused"
  por serem recém-criados).
- `npx tsc -b --noEmit` limpo; suíte vitest completa: 67 arquivos / 414
  testes verdes (era 65/397 antes dos tickets 03 e 04).
