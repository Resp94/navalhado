# 05 — Processar o primeiro contato recebido

**What to build:** Fazer uma nova mensagem direta recebida pela Instância WhatsApp criar ou reutilizar o Cliente Provisório do tenant e responder com seu link do Canal do Cliente exatamente uma vez, usando o webhook individual da Uazapi com autenticação e filtros defensivos.

**Blocked by:** 03 — Ativar uma instância pela Uazapi.

**Status:** ready-for-agent

- [ ] O webhook resolve a Instância WhatsApp e seu tenant somente após validar o token recebido.
- [ ] Webhooks sem token, com token inválido ou sem integração correspondente não produzem efeitos.
- [ ] Apenas eventos novos de mensagens diretas recebidas são processados.
- [ ] Histórico, grupos, mensagens próprias e mensagens originadas pela API são ignorados mesmo se a configuração externa estiver incorreta.
- [ ] O telefone é convertido para o formato canônico brasileiro antes da busca do cliente.
- [ ] O fluxo existente cria ou reutiliza Cliente Provisório sem duplicar telefone dentro do tenant.
- [ ] O link usa o Token de Acesso do Cliente e a URL pública do ambiente correto.
- [ ] O Ambiente Dev envia exclusivamente links da URL Pública Dev.
- [ ] A resposta é enviada pelo endpoint de texto da Uazapi.
- [ ] O identificador externo da mensagem impede uma segunda resposta em reentregas.
- [ ] O corpo sensível do webhook não é registrado integralmente.
- [ ] Testes cobrem mensagem válida, autenticação, filtros, normalização, criação/reuso e reentrega.

