# 04 — Envio manual compatível

**What to build:** O teste de mensagem manual da tela de WhatsApp envia texto para o tenant correto usando o contrato único do backend, com autenticação e validações consistentes.

**Blocked by:** 01 — Seam de despacho e baseline de regressão

**Status:** done

- [x] A interface envia tenant, número do destinatário e texto usando o contrato canônico do endpoint.
- [x] O backend rejeita requisição sem autenticação Bearer válida.
- [x] O backend confirma que o usuário pode enviar mensagens no tenant informado.
- [x] Número ausente, inválido ou texto vazio são rejeitados antes do provider.
- [x] O envio manual usa o mesmo adapter e as mesmas regras de timeout e erro do dispatcher.
- [x] O teste de template da tela apresenta sucesso ou erro real sem depender de nomes de campos incompatíveis.
- [x] Nenhum token, segredo ou corpo completo da resposta UAZAPI é exibido ao cliente.
