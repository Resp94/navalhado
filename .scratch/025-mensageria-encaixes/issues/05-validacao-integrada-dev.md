# 05 — Validação integrada da Spec 025 em DEV

**What to build:** Validar toda a Spec 025 no banco e na aplicação de desenvolvimento, reunindo testes automatizados, inspeção de outbox e evidências visuais desktop e mobile sem enviar mensagens reais.

**Blocked by:** 01, 02, 03 e 04.

**Status:** ready-for-agent

- [ ] A suíte automatizada cobre encaixe passado, encaixe futuro, proteção no gatilho e no handler direto, idempotência, retry e isolamento por tenant.
- [ ] A persistência do outbox registra o resultado esperado e o motivo de supressão sem expor dados sensíveis.
- [ ] A agenda confirma os estados visuais do card antes e depois de serviço e comanda finalizados.
- [ ] A confirmação exibe o valor formatado e os demais templates e fluxos de mensageria permanecem funcionais.
- [ ] A validação visual é feita somente no ambiente DEV, no navegador interno, em desktop e mobile, com prints ou gravação como evidência.
- [ ] Os testes não disparam mensagens reais para clientes ou barbeiros.
- [ ] Toda alteração de banco usa migration nova, versionada e aplicada somente no DEV durante esta etapa.
- [ ] Nenhum teste, evidência, log ou snapshot contém telefone completo, token, segredo ou chave de API.
- [ ] O resultado é confrontado com os snapshots vigentes de mensageria, agenda e baseline DEV antes de marcar a spec como funcional.
- [ ] A validação não altera produção nem publica mudanças no GitHub.

