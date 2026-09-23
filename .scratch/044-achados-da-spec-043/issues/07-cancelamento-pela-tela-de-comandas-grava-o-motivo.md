# 07: Cancelamento pela tela de Comandas grava o Motivo de Cancelamento

**What to build:** cancelar pela tela de Comandas encerra a Comanda e o Agendamento na mesma operação. Depois da spec 043, essa via grava a autoria (barbearia), mas continua sem gravar o Motivo de Cancelamento. O Painel de Cancelados do Dia mostra esses casos como "Sem motivo informado", ao lado de cancelamentos idênticos feitos pela Agenda que trazem o motivo por extenso.

Para quem lê o painel, a diferença não tem explicação: o mesmo cancelamento, feito em duas telas, aparece de dois jeitos. Depois deste ticket, cancelar pela tela de Comandas pede e grava o motivo, como a Agenda já faz.

**Onde foi achado:** desvio registrado no ticket 06 da spec 043, que incluiu essa quarta via na autoria mas deixou o motivo de fora do escopo.

**Blocked by:** 01 (Provas de banco da spec 043) — os testes de banco das funções de cancelamento precisam estar verdes antes de elas serem alteradas

**Status:** done

- [x] A operação de cancelar Comanda e Agendamento juntos passa a receber e gravar o Motivo de Cancelamento
- [x] A tela de Comandas pede o motivo antes de cancelar, como a Agenda pede
- [x] A autoria gravada por essa via continua sendo a da barbearia
- [x] Motivo em branco ou só com espaço é recusado, com a mesma exigência da Agenda
- [x] Cancelamento feito por essa via antes deste ticket continua sem motivo; nenhum backfill
- [x] O motivo gravado por essa via aparece no Painel de Cancelados do Dia do gerente e do barbeiro, e na Central 360º do cliente
- [x] A atomicidade não regride: ou Comanda e Agendamento são cancelados juntos, ou nada muda
- [x] pgTAP: o motivo é gravado, o motivo em branco é recusado, a atomicidade se mantém, e o isolamento por barbearia continua valendo, incluindo o gestor com identificador de barbearia nulo
- [x] Teste de tela da Comanda cobrindo que o cancelamento pede o motivo e o repassa
- [x] O pgTAP 17, que já cobre a função de cancelamento da Comanda, passa inteiro depois da mudança
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Achado ao investigar a tela:** `public.cancel_comanda_appointment` só é chamada pela UI para a Comanda de balcão (sem Agendamento) — `ComandaRepository.cancelComanda` sempre manda `p_appointment_id: null`. Quando há Agendamento, `ComandaCheckoutModal` já chama `AgendaRepository.cancelar` (RPC `cancel_appointment_by_manager`), que pede e grava motivo desde a spec 040; o cancelamento da Comanda vinculada é feito por gatilho de banco (`trg_auto_cancel_comanda_on_appointment_cancel`) na mesma transação. Ou seja, a critério "tela pede o motivo" e "teste de tela cobrindo isso" já estavam cobertos antes deste ticket (`ComandaCheckoutModal.test.tsx`, teste "cancela o atendimento pelo AgendaRepository exigindo o motivo (spec 040)"); nenhuma mudança de UI foi necessária.
- O gap real é só na RPC `cancel_comanda_appointment` em si: continua sendo a via de cancelamento com Agendamento exposta pela API (documentada como tal desde a migration do ticket 06/043), e ela não exigia nem gravava motivo — dados cancelados por essa via ficam "Sem motivo informado" no Painel, mesmo com autoria. Corrigido só na função.
- Migration `supabase/migrations/20260922110000_044_ticket07_comanda_grava_motivo_cancelamento.sql`, aplicada no ambiente de desenvolvimento: acrescenta `p_reason text DEFAULT NULL` como quarto parâmetro; exige motivo (não vazio, sem contar espaço) só quando `p_appointment_id` é informado; grava em `cancellation_reason` no mesmo `update` que já grava `canceled_by = 'shop'`. Comanda de balcão continua sem exigir motivo.
- **Duas correções feitas durante a verificação, ambas incorporadas à mesma migration antes de fechar o ticket:**
  - `CREATE OR REPLACE FUNCTION` não substitui função por assinatura de parâmetros diferente — casa só pelos tipos. A primeira tentativa criou um segundo overload (`uuid,uuid,uuid,text`) ao lado do antigo (`uuid,uuid,uuid`), deixando toda chamada de 3 argumentos ambígua (`is not unique`). Corrigido com `drop function if exists ...(uuid,uuid,uuid)` antes do `create`.
  - O `drop` apaga o ACL da função; o schema `public` tem default privilege do Supabase que concede `EXECUTE` a `anon`/`authenticated`/`service_role` em toda função nova, como grant explícito em cada role (não via `PUBLIC`) — reabrindo a RPC `SECURITY DEFINER` para `anon`. Achado conferindo grants antes/depois, como o ticket 06 desta spec exige. Corrigido revogando de `anon` por nome; grants finais idênticos aos de antes do ticket: `authenticated`, `postgres`, `service_role` — sem `anon`.
- **Vermelho provado antes da correção:** pgTAP 55 (nova, dedicada) rodado contra a função antiga via harness (`scripts/pgtap-report.mjs`) — 9 das 15 asserções falharam exatamente nas que chamam a função com motivo (`function ... does not exist`), confirmando que o comportamento não existia. Depois da migration: **15/15**.
- pgTAP 55 cobre: motivo gravado e autoria mantida quando há Agendamento; motivo em branco e motivo só com espaço recusados, sem alterar nem a Comanda nem o Agendamento (atomicidade); Comanda de balcão cancela sem motivo; isolamento (barbeiro, gerente de outra barbearia, gerente com barbearia nula) recusado mesmo informando motivo, sem gravar nada.
- Corrigidos dois pgTAP existentes que dependiam da assinatura antiga de 3 parâmetros:
  - **53** (autoria, spec 043/ticket06): a chamada `lives_ok` que cancela pela Comanda passou a informar motivo (`'Motivo t53'`); as três chamadas de isolamento (`throws_ok`) não precisaram de motivo porque o acesso é recusado antes da validação de motivo. **25/25**.
  - **17** (code review regressions): `has_function` e `pg_get_functiondef` atualizados de `array['uuid','uuid','uuid']` para `array['uuid','uuid','uuid','text']`. **26/26**.
- Suíte completa da aplicação: 109 arquivos, 1193 testes (nenhum teste de aplicação mudou; a mudança é só de banco, e a UI já cobria o caminho com Agendamento). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0, os mesmos 47 avisos preexistentes. `npm run build`: build 0.
- Contagens do banco no ambiente de desenvolvimento, conferidas depois de toda a verificação: `tenants=3, appointments=35, customers=6, professionals=6, services=11, waiting_list=0, blocked_slots=0` — idênticas à linha de base do ticket 01. Todo teste rodou dentro de transação desfeita; nada ficou para trás.
- Migration só aplicada no ambiente de desenvolvimento; a aplicação em produção fica adiada por decisão do responsável (ver Out of Scope da spec 044), sem ticket próprio enquanto ele não decidir promover.
