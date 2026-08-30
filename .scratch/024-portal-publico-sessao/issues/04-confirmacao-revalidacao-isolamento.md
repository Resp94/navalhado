# 04 — Confirmação transacional e isolamento por tenant

**What to build:** A confirmação pública revalida o horário no servidor antes de persistir, trata concorrência de forma controlada e mantém cliente, agendamento e disponibilidade isolados pelo tenant correto.

**Blocked by:** 01 — Entrada pública por slug e sessão do cliente; 03 — Disponibilidade pública somente com horários acionáveis.

**Status:** ready-for-agent

- [ ] A confirmação revalida a disponibilidade no Supabase imediatamente antes da persistência.
- [ ] No agendamento sem sessão, a confirmação continua exigindo nome e telefone.
- [ ] No agendamento iniciado pelo gerenciamento, nome e telefone da sessão são preenchidos e validados novamente no servidor.
- [ ] Uma concorrência que ocupa o horário antes da confirmação recebe resposta controlada.
- [ ] A falha de revalidação não cria agendamento duplicado.
- [ ] Cliente novo é persistido somente no momento permitido pela confirmação.
- [ ] Cliente, serviço, profissional e agendamento pertencem ao tenant resolvido pelo slug/sessão.
- [ ] Um tenant não consegue confirmar ou consultar dados de outro tenant.
- [ ] A resposta de erro não expõe token, segredo ou dados sensíveis.
- [ ] Permissões, isolamento e `search_path` das funções de banco permanecem protegidos.
- [ ] Operações de gerenciamento autorizam pelo `auth.uid()` do Supabase Auth anônimo, nunca por UUID público isolado.
- [ ] Qualquer alteração de banco é criada como migration numerada e aplicada somente em DEV via MCP.
- [ ] Testes automatizados cobrem concorrência, duplicidade, cliente novo e isolamento.
