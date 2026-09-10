# 04 — Proteger a quitação de comissões

**What to build:** O gerente registra pagamentos parciais ou totais de comissão por uma operação segura, enquanto excesso, concorrência, método inválido e profissional de outro tenant são rejeitados integralmente.

**Blocked by:** 03 — Restringir operações financeiras e de estoque.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP a definição e os grants vigentes da função de quitação no DEV.
- [ ] Criar migration nova sem habilitar inserção direta irrestrita na tabela de quitações.
- [ ] Exigir usuário ativo com papel financeiro autorizado no tenant.
- [ ] Validar que o profissional existe e pertence ao mesmo tenant.
- [ ] Validar valor positivo e método pertencente ao conjunto canônico do sistema.
- [ ] Aceitar pagamento parcial e pagamento total exato.
- [ ] Rejeitar valor superior ao saldo pendente sem criar registro parcial.
- [ ] Impedir que quitações concorrentes ultrapassem juntas o saldo disponível.
- [ ] Preservar o retorno esperado pela experiência atual de quitação.
- [ ] Aplicar no DEV via MCP e validar função, RLS, grants e testes de concorrência.
- [ ] Manter verdes os testes atuais do Financeiro e do modal de quitação.
