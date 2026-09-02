# 02 — Encaixe personalizado no painel do gerente

**What to build:** O gerente consegue acessar o fluxo operacional de encaixe, escolher entre horário da grade e horário personalizado, informar um horário livre e salvar o encaixe na Agenda.

**Blocked by:** 01 — Seam de horário para encaixes

**Status:** ready-for-agent

- [ ] Exibir a escolha entre “Usar horário da grade” e “Horário personalizado”.
- [ ] Manter o seletor atual para encaixes pela grade.
- [ ] Exibir um controle de horário com precisão de minutos no modo personalizado.
- [ ] Permitir horário fora da grade, fora do expediente do barbeiro e fora do funcionamento da barbearia quando o modo personalizado estiver ativo.
- [ ] Manter seleção de data, serviço, profissional e cliente conforme o fluxo atual.
- [ ] Persistir o registro como encaixe, com início, fim, tenant, profissional, serviço e origem corretos.
- [ ] Não alterar as configurações de funcionamento, escala ou intervalo do tenant.
- [ ] Atualizar a Agenda e apresentar confirmação após o salvamento.
- [ ] Cobrir sucesso, campos obrigatórios, horário inválido e falha de persistência.
