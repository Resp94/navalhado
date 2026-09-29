# 06: Tela Assinatura e histórico de cobranças (05b)

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** em Configurações, o Gerente vê a própria assinatura: plano, situação, dias de teste restantes, próxima cobrança, final do cartão e o histórico de cobranças.

- Módulo de assinatura no front, no padrão Repository com adaptador Supabase e adaptador em memória para os testes.
- A tela Assinatura substitui a seção mínima do ticket 05 e mostra:
  - plano e preço
  - situação, em linguagem de gente: em teste até DD/MM, ativa, pagamento recusado, cancelada até DD/MM, cortesia
  - próxima cobrança
  - bandeira e final do cartão
  - histórico com valor, data, situação e tipo (mensalidade ou diferença de plano)
- O botão "Assinar" aparece quando não há assinatura ativa. As ações de trocar cartão, mudar de plano, cancelar e exportar dados entram nos próprios tickets, e a tela reserva o lugar delas.
- A tela lê o histórico gravado pelo webhook e não consulta o Mercado Pago a cada abertura.

**Blocked by:** 05 (Assinar pelo Mercado Pago, 05a)

**Status:** ready-for-agent

- [ ] Teste do módulo com o adaptador em memória: lê assinatura e histórico do próprio tenant
- [ ] Teste da tela: mostra cada situação com o texto certo, a próxima cobrança, o final do cartão e o histórico; mostra "Assinar" só sem assinatura ativa
- [ ] Conferido no DEV com a assinatura de teste do ticket 05: a tela mostra a cobrança aprovada
- [ ] `npm run lint`, `npm test` e `npm run build` passam
