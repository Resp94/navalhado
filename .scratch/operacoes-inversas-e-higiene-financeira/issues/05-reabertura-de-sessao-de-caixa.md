# 05 — Reabertura de Sessão de Caixa

**What to build:** O gerente reabre um turno encerrado por engano, informando o motivo, e volta a lançar sangria e suprimento naquele turno para refazer a conferência. A fotografia do fechamento anterior é preservada como auditoria, e tentar reabrir enquanto já existe outro turno aberto na barbearia devolve uma recusa compreensível, não um erro técnico.

**Blocked by:** 01 — Suíte de banco confiável; 02 — Histórico de migrations reconciliado; 04 — Quitação de Comissão sai da gaveta.

**Status:** done — migration aplicada no DEV, pgTAP e vitest verdes

- [x] Consultar pelo MCP as colunas, policies e índices vigentes da tabela de sessões de caixa no DEV.
- [x] Criar migration nova com a tabela de reaberturas de caixa, somente leitura para papéis financeiros e sem escrita direta para `authenticated`, com índice em cada chave estrangeira.
- [x] Criar a função remota de reabertura exigindo usuário ativo com papel financeiro, unidade correspondente e motivo com o mesmo mínimo de caracteres já exigido no ajuste posterior.
- [x] Verificar a existência de outro turno aberto na unidade antes da transição e devolver erro de domínio próprio, sem expor violação do índice único parcial.
- [x] Copiar para a tabela de reaberturas a fotografia completa do fechamento — valor declarado, esperado, divergência, composição por método, contagem de pagamentos, suprimentos, sangrias, quitações em dinheiro e versão de cálculo — antes de devolver a sessão para aberta.
- [x] Limpar os campos de fechamento da sessão reaberta, para que um novo fechamento produza apuração íntegra em vez de somar sobre a anterior.
- [x] Preservar os ajustes posteriores já registrados, associados ao fechamento a que pertenciam.
- [x] Cobrir por pgTAP: reabertura preserva a fotografia e devolve a sessão para aberta; recusa de domínio com turno já aberto; turno reaberto aceita sangria e suprimento; novo fechamento apura a partir do estado corrigido; papel não autorizado recusado.
- [x] Acrescentar a operação ao contrato do `CaixaRepository` de forma aditiva e cobrir a validação de entrada.
- [x] Aplicar no DEV pelo MCP e comparar advisors antes e depois.

## Notas de execução

- Migration `20260912010000_reabertura_sessao_caixa` aplicada no DEV via
  MCP, versão reconciliada com o nome do arquivo.
- Tabela `cash_session_reopenings` guarda a fotografia completa do
  fechamento anterior (valores por método, contagem de pagamentos,
  suprimentos/sangrias, versão de cálculo, autor e instante do fechamento
  original) mais autor, instante e motivo da reabertura. RLS restrita a
  gerente/proprietário do tenant (ou saas admin); `authenticated` só tem
  SELECT — nenhuma escrita direta, só via `reopen_cash_session`.
- `reopen_cash_session` verifica a existência de outro turno aberto no
  tenant **antes** da transição e devolve erro de domínio próprio
  ("Ja existe uma sessao de caixa aberta para esta unidade."), nunca a
  violação do índice único parcial `idx_single_open_cash_session_per_tenant`.
- Novo `supabase/tests/database/20_reabertura_sessao_caixa.test.sql`
  (15 asserções): justificativa mínima, reabertura preservando a fotografia
  original, sessão volta a aceitar sangria/suprimento, recusa de segunda
  reabertura, recusa quando outro turno já está aberto, e grants
  somente-leitura na tabela de auditoria.
- Frontend: `CaixaRepository` e `SupabaseCaixaAdapter` ganham `reopenSession`
  / `reabrirCaixa` de forma aditiva (assinatura de `ICaixaAdapter` cresceu,
  então os quatro test doubles existentes — `AberturaAssistidaCaixaModal`,
  `FechamentoCaixaModal`, `ComandaCheckoutModal`, `CaixaRepository` —
  ganharam o mock correspondente). Nenhuma tela nova; a fiação visual fica
  para trabalho posterior, conforme a spec.
- Advisors de segurança sem alerta novo; `npx tsc -b --noEmit` limpo; vitest
  completo: 67 arquivos / 419 testes verdes (era 414 após o ticket 04).
