# 05 — Validar o portal público manualmente em DEV

**What to build:** Uma validação manual reproduzível comprova no navegador integrado, em desktop e mobile, os fluxos de sessão, links sem token, horários acionáveis, reagendamento, estado vazio e revalidação pública.

**Blocked by:** 02 — Links públicos e gerenciamento da sessão; 03 — Disponibilidade pública somente com horários acionáveis; 04 — Confirmação transacional e isolamento por tenant.

**Status:** ready-for-agent

- [ ] O checklist manual usa exclusivamente `https://dev.navalhado.com.br`.
- [ ] As credenciais são obtidas somente de `docs/credenciais_teste.md` e não aparecem em prints, logs ou relatórios.
- [ ] O primeiro contato é validado pelo domínio e slug, sem token exposto.
- [ ] A sessão identifica cliente existente e permite o fluxo de cliente novo sem cliente fantasma.
- [ ] O fluxo `Agendar` mantém a ordem serviços → profissionais → horários → confirmação.
- [ ] O fluxo `Gerenciar meus agendamentos` inicia a sessão, permite `Novo agendamento` e mantém nome/telefone preenchidos na confirmação.
- [ ] `Sair` encerra a sessão e devolve o cliente ao catálogo público normal.
- [ ] Confirmação, cancelamento, reagendamento e lembrete são validados com slug/sessão.
- [ ] Novo agendamento e reagendamento exibem somente horários disponíveis.
- [ ] Horários indisponíveis não aparecem como botões inativos.
- [ ] Estado vazio e isolamento entre tenants são comprovados.
- [ ] A revalidação de concorrência é comprovada sem criar duplicidade.
- [ ] Prints desktop e mobile são salvos em `verificacoes/` sem dados sensíveis.
- [ ] Nenhuma mensagem real é enviada, nenhum dado de produção é alterado e nenhuma migration é aplicada fora do DEV.

**Checklist de execução:** [Validação manual 024](../../../verificacoes/024-portal-publico-sessao.md).
