# 01 — Congelar contratos e integridade atuais

**What to build:** Uma linha de base verificável do comportamento atual de estoque, comandas, caixa e comissões, acompanhada de uma fotografia do Supabase DEV, para que as correções seguintes demonstrem que preservaram tudo o que já funciona.

**Blocked by:** None — can start immediately.

**Status:** in-progress — baseline implementado, pendente execução pgTAP e ampliação da matriz comportamental

- [x] Consultar pelo MCP do Supabase o projeto DEV e registrar versão, migrations, funções, policies, grants, constraints e advisors relacionados ao escopo.
- [x] Confirmar que nenhuma consulta ou alteração é executada em produção.
- [ ] Caracterizar integralmente os contratos públicos usados pelos repositórios de Produtos, Comandas, Caixa e Financeiro; a cobertura atual é focada em delegação e mocks.
- [ ] Cobrir integralmente os fluxos atuais bem-sucedidos de abertura e fechamento de caixa, fechamento e reabertura de comanda e quitação de comissão; a cobertura atual ainda não exercita todos os adapters e a quitação em cenário real.
- [x] Registrar em testes a incompatibilidade atual entre os tipos de movimento aceitos pelo schema e pela função de estoque.
- [ ] Registrar integralmente em testes os limites atuais de autorização, isolamento por tenant e usuário ativo; a leitura tenant-scoped e o comportamento de usuário inativo estão caracterizados, mas a matriz de escrita ainda está pendente.
- [ ] Executar todas as suítes existentes do escopo e guardar o resultado como baseline; os testes focados passam, mas a execução agregada trava antes da coleta.
- [x] Não modificar schema, dados, policies, funções ou comportamento da aplicação neste ticket.
