# 08: Editar e cancelar Conta a Pagar

**What to build:** o gestor corrige uma Conta a Pagar lançada com dado errado, dentro do que o
estado dela permite, e cancela uma conta lançada por engano informando o motivo. A conta cancelada
sai das listas e dos totais sem desaparecer da auditoria.

A edição é limitada pelo estado porque uma correção não pode reescrever o que já saiu do caixa: numa
conta paga, vencimento e valor viraram histórico de um pagamento concluído. O cancelamento só é
aceito sem Baixa ativa e é terminal: uma conta cancelada por engano é lançada de novo, não
reativada — reativar exigiria decidir o que acontece com a Série e com o vencimento já passado, e
o custo de relançar é um formulário.

Arquivar uma Categoria de Despesa ou um Fornecedor depois não afeta as contas já lançadas: elas
continuam exibindo o nome, e manter o que já estava na conta é sempre permitido.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 2 — Livro de Contas a Pagar"
(cancelamento e edição individual).

**Blocked by:** 07 — Baixa fora do caixa e Estorno de Baixa.

**Status:** done

- [x] RPC de edição individual respeita o estado:
  - [x] aberta: tudo editável;
  - [x] parcialmente paga: valor travado, demais campos editáveis;
  - [x] paga: só descrição, categoria, fornecedor, documento, observação e competência;
  - [x] cancelada: nada.
- [x] Categoria e Fornecedor novos precisam estar ativos; manter os que já estavam na conta é
      sempre permitido, mesmo arquivados.
- [x] Toda edição grava autor e momento da última alteração (história 38).
- [x] RPC de cancelamento só aceita conta sem Baixa ativa, exige motivo com pelo menos cinco
      caracteres, grava autor, momento e motivo e é terminal (história 19).
- [x] Conta cancelada sai do estado padrão da lista ("todas exceto canceladas") e continua
      acessível pelo detalhe.
- [x] O contrato de detalhe passa a devolver a trilha de cancelamento (história 35).
- [x] Contas cujas categoria ou fornecedor foram arquivados depois continuam exibindo o nome.
- [x] Na aba, diálogo de edição e diálogo de cancelamento com motivo.
- [x] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [x] categoria arquivada aceita quando já estava na conta;
  - [x] cancelamento com Baixa ativa é recusado;
  - [x] campos travados por estado são recusados na edição;
  - [x] profissional e gerente de outro tenant não editam nem cancelam.
- [x] Testes de repositório e de adaptador do módulo cobrem edição e cancelamento.
- [x] Teste da aba cobre edição e cancelamento com repositório injetado.
- [x] `npm run test` e `npm run test:db` verdes.

## Notas de implementação

- Migration `supabase/migrations/20260914100000_editar_e_cancelar_conta_a_pagar.sql` aplicada em
  duas partes no DEV via MCP `apply_migration` (`update_payable`, `cancel_payable`), verificada ao
  vivo por `to_regprocedure`.
- `update_payable` só reconsulta ativo de Categoria/Fornecedor quando o valor realmente muda
  (`is distinct from` contra o valor atual da linha travada) — manter o que já estava na conta é
  sempre aceito, mesmo arquivado. Valor travado a partir de `partially_paid`; vencimento travado
  a partir de `paid`; `cancelled` recusa qualquer edição antes mesmo de validar os campos.
- `cancel_payable` só aceita `status = 'open'` (equivalente a "sem Baixa ativa"), é terminal e
  reusa o padrão de trilha de cancelamento (`cancelled_at`/`cancelled_by`/`cancellation_reason`,
  já garantido pela restrição `payables_cancellation_trail_check` do ticket 06/036).
- Módulo estendido com `editarConta`/`cancelarConta`; `ContasPagarRepository` ganhou
  `validarCamposComuns` privado, reusado por `criarContaAvulsa` e `editarConta` (mesma validação
  de descrição/categoria/valor/vencimento/documento/observação). Componentes novos:
  `EditarContaDialog.tsx` e `CancelarContaDialog.tsx`, com botões "Editar" e "Cancelar conta" no
  `ContaPagarDetalheDrawer.tsx` (Editar disponível fora de `cancelled`; Cancelar só em `open`).
- Suíte pgTAP `29_contas_a_pagar.test.sql` estendida de 83 para 110 asserções, validada ao vivo no
  DEV via MCP `execute_sql` (a seção nova foi validada isoladamente, com contexto próprio, antes
  de ser incorporada ao arquivo acumulado — todas as 27 asserções novas passaram).
- Testes de front: `ContasPagarRepository.test.ts` (+15 casos), `SupabaseContasPagarAdapter.test.ts`
  (+4 casos) e `ContasPagarTab.test.tsx` (+2 casos: editar e cancelar pelo detalhe, com o
  `FakeContasPagarAdapter` estendido). `npx tsc -b` e `npx oxlint` limpos.
- Verificação visual em navegador não foi feita nesta sessão, pela mesma limitação já registrada
  nos tickets 06 e 07/036.
