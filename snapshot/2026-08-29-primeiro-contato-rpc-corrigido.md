# Snapshot operacional — primeiro contato WhatsApp corrigido

**Data:** 29/08/2026 (validação remota; logs observados até 04:20 UTC)
**Commit de referência:** `2d880f4`.
**Working tree:** snapshot pendente de commit local.

## Ambiente da validação

- Banco DEV: projeto `Navalhado-dev` (`selvxobcjbkligxighlp`).
- Banco PROD: projeto `Navalhado` (`boakqstrdfqmsrwnjore`).
- Edge Function `whatsapp-integration` existente preservada; não foi necessário novo deploy.

## Diagnóstico

- Webhooks de mensagens chegavam à Edge Function em PROD.
- O cron de boas-vindas também era executado.
- Novos clientes falhavam antes do dispatcher com `column reference "token_acesso" is ambiguous`.
- Após qualificar o `RETURNING`, o teste revelou que `telefone_normalizado` é uma coluna generated e não pode receber valor explícito.

## ✅ Funcional

- `find_or_create_whatsapp_customer` cria cliente novo em DEV sem erro.
- `find_or_create_whatsapp_customer` cria cliente novo em PROD sem erro.
- A inserção de teste foi executada dentro de transação e revertida, sem criar dados operacionais.
- Testes da Edge Function: 72 aprovados.
- Migrations corretivas aplicadas nos dois ambientes.

## Alterações versionadas

- `20260829041532_fix_whatsapp_customer_token_ambiguity.sql`
- `20260829041641_fix_whatsapp_customer_generated_phone.sql`
- `20260829041837_reassert_whatsapp_customer_rpc_fix.sql`
- `supabase/tests/database/whatsapp_customer_rpc.test.sql`

## Regras críticas preservadas

- Não alterar o contrato de envio da UAZAPI.
- Não inserir valor manual na coluna generated `telefone_normalizado`.
- Manter o isolamento por tenant e a origem `whatsapp_bot`.
- Manter migrations existentes imutáveis.

## ⚠️ Limitações e pendências

- As falhas históricas de primeiro contato permanecem no ledger como registros `failed`; elas não foram reprocessadas artificialmente.
- Ainda falta confirmar um novo envio real pelo WhatsApp após a correção. O teste final deve ser feito com um número novo ou uma mensagem cujo webhook ainda não tenha sido processado.
- Os advisors do Supabase continuam exibindo alertas históricos de `SECURITY DEFINER` e outbox sem policy, fora do escopo desta correção.

## Verificações executadas

- Teste pgTAP transacional no DEV — aprovado.
- Teste pgTAP transacional no PROD — aprovado.
- Testes da Edge Function — 72 aprovados.
- Logs PROD — causa raiz confirmada antes da correção.
- Nenhum secret, token ou telefone completo foi exposto.
