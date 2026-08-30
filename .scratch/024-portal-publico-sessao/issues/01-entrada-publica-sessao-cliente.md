# 01 — Entrada pública por slug e sessão do cliente

**What to build:** O cliente consegue acessar a barbearia pelo domínio e slug, informar nome e telefone e iniciar uma sessão vinculada ao tenant correto, sem token na URL e sem criação de cliente fantasma antes da confirmação.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] O domínio mais o slug abre o portal público do tenant correto.
- [ ] A URL de primeiro contato não contém `?token=` nem token no caminho.
- [ ] Nome e telefone são normalizados antes da busca do cliente.
- [ ] Cliente existente é identificado dentro do tenant correto.
- [ ] Cliente novo pode iniciar a sessão sem criar registro provisório antes da confirmação.
- [ ] A sessão permanece disponível durante a seleção de serviço, profissional e data.
- [ ] Um slug não permite acessar dados de outro tenant.
- [ ] Testes automatizados cobrem cliente existente, cliente novo, normalização e isolamento.
- [ ] A validação manual em DEV é possível em desktop e mobile, sem expor credenciais nas evidências.
