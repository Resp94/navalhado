# 05 — Aba Caixa Operacional do Dia e Ações Rápidas

**What to build:**
Implementar a 3ª aba da Bottom Bar do Gerente focada no caixa da barbearia: exibir o status da sessão de caixa (aberto com saldo inicial / fechado), o faturamento bruto recebido no dia de hoje subdividido visualmente por método de pagamento (PIX, Cartão, Dinheiro), botões de ação imediata para registrar Sangria (retirada), Suprimento (entrada) e Fechamento de Caixa, acompanhado de um card sutil informando que relatórios analíticos, gráficos e DREs mensais devem ser acessados na versão desktop.

**Blocked by:** 01 — Infraestrutura de Layout Base, Bottom Navigation e Modais Bottom Sheet

**Status:** ready-for-agent

- [ ] Card de topo com status do caixa (*Aberto* com horário/saldo inicial ou *Fechado* com botão para abertura).
- [ ] Destaque visual grande do total faturado no dia de hoje, acompanhado de pílulas/badges informando os valores por método (PIX, Cartão, Dinheiro).
- [ ] Ações rápidas em botões de fácil alcance: `+ Entrada (Suprimento)`, `– Retirada (Sangria)` e `🔒 Fechar Caixa`.
- [ ] Modais de sangria, suprimento e fechamento operando em formato ergonômico mobile (*Bottom Sheet*).
- [ ] Card/aviso informativo direcionando o usuário para a versão desktop quando necessitar de gráficos de 30/90 dias ou relatórios contábeis detalhados.
