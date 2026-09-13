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

**Status:** ready-for-agent

- [ ] O contrato de leitura do extrato da Sessão de Caixa devolve, em cada movimento, o sentido e
      os vínculos já existentes na linha, com chaves aditivas e sem mudar assinatura.
- [ ] O extrato impresso lista o vale de profissional com rótulo próprio.
- [ ] Um movimento de tipo sem rótulo conhecido aparece com rótulo genérico de entrada ou saída,
      conforme o sentido, e nunca é omitido.
- [ ] A soma das linhas impressas explica o valor esperado da sessão (história 5).
- [ ] A suíte pgTAP `22_extrato_sessao_caixa` continua verde, cobrindo as chaves novas.
- [ ] O teste de página existente do extrato ganha caso com vale.
- [ ] `npm run test` e `npm run test:db` verdes.
