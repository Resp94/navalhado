# 01 — Congelar contratos e integridade atuais

**What to build:** Uma linha de base verificável do comportamento atual de estoque, comandas, caixa e comissões, acompanhada de uma fotografia do Supabase DEV, para que as correções seguintes demonstrem que preservaram tudo o que já funciona.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP do Supabase o projeto DEV e registrar versão, migrations, funções, policies, grants, constraints e advisors relacionados ao escopo.
- [ ] Confirmar que nenhuma consulta ou alteração é executada em produção.
- [ ] Caracterizar os contratos públicos usados pelos repositórios de Produtos, Comandas, Caixa e Financeiro.
- [ ] Cobrir os fluxos atuais bem-sucedidos de abertura e fechamento de caixa, fechamento e reabertura de comanda e quitação de comissão.
- [ ] Registrar em testes a incompatibilidade atual entre os tipos de movimento aceitos pelo schema e pela função de estoque.
- [ ] Registrar em testes os limites atuais de autorização, isolamento por tenant e usuário ativo.
- [ ] Executar as suítes existentes do escopo e guardar o resultado como baseline.
- [ ] Não modificar schema, dados, policies, funções ou comportamento da aplicação neste ticket.
