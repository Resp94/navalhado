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

**Status:** ready-for-agent

- [ ] RPC de edição individual respeita o estado:
  - [ ] aberta: tudo editável;
  - [ ] parcialmente paga: valor travado, demais campos editáveis;
  - [ ] paga: só descrição, categoria, fornecedor, documento, observação e competência;
  - [ ] cancelada: nada.
- [ ] Categoria e Fornecedor novos precisam estar ativos; manter os que já estavam na conta é
      sempre permitido, mesmo arquivados.
- [ ] Toda edição grava autor e momento da última alteração (história 38).
- [ ] RPC de cancelamento só aceita conta sem Baixa ativa, exige motivo com pelo menos cinco
      caracteres, grava autor, momento e motivo e é terminal (história 19).
- [ ] Conta cancelada sai do estado padrão da lista ("todas exceto canceladas") e continua
      acessível pelo detalhe.
- [ ] O contrato de detalhe passa a devolver a trilha de cancelamento (história 35).
- [ ] Contas cujas categoria ou fornecedor foram arquivados depois continuam exibindo o nome.
- [ ] Na aba, diálogo de edição e diálogo de cancelamento com motivo.
- [ ] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [ ] categoria arquivada aceita quando já estava na conta;
  - [ ] cancelamento com Baixa ativa é recusado;
  - [ ] campos travados por estado são recusados na edição;
  - [ ] profissional e gerente de outro tenant não editam nem cancelam.
- [ ] Testes de repositório e de adaptador do módulo cobrem edição e cancelamento.
- [ ] Teste da aba cobre edição e cancelamento com repositório injetado.
- [ ] `npm run test` e `npm run test:db` verdes.
