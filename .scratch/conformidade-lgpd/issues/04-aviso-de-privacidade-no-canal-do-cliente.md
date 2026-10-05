# 04: Aviso de privacidade no Canal do Cliente

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** o formulário de identificação do Canal do Cliente (nome e telefone, `ModalIdentificacaoCliente`) ganha uma linha curta antes do botão. Ela diz que a barbearia usa esses dados para marcar o horário e mandar avisos pelo WhatsApp e traz um link "Política de Privacidade".

Não há caixa de "aceito": a base legal é a execução do pedido de agendamento.

O link aponta para `/privacidade` (ticket 05). Até o 05 existir, abre o `TermosDaPlataformaModal` na Política.

Hoje o cliente informa nome e telefone sem ver aviso nenhum (lacuna anotada no ticket 16 da spec 052).

**Blocked by:** None (can start immediately; troca o link quando o 05 chegar)

**Status:** ready

- [ ] Texto curto e o link no formulário, legíveis em 375 px
- [ ] Vitest: o aviso aparece e o link abre a Política
- [ ] Conferido no navegador do app, no `/:slug` de uma barbearia do DEV, sem enviar o formulário
- [ ] Gates de lint, Vitest e build passam
