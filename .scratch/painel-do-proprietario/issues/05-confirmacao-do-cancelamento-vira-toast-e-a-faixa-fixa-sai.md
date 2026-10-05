# 05: A confirmação do cancelamento vira toast e a faixa fixa da cancelada sai

Parte da spec 054 (Painel do Proprietário).

**What to build:** depois que o Gerente cancela a assinatura, ele vê "Assinatura cancelada. Acesso até DD/MM." numa mensagem que some sozinha (toast), e o painel não fica com uma faixa fixa no topo até o fim do período pago. A situação continua à vista em Ajustes > Assinatura ("Cancelada até DD/MM" e "Assinar de novo") e, quando o acesso termina, na tela de bloqueio. As faixas que pedem providência (teste terminando, pagamento recusado, acesso liberado à mão) seguem fixas como hoje.

Hoje, depois de cancelar, a faixa "Assinatura cancelada. Acesso até 03/11." fica no topo de todas as telas do painel até o fim do período pago (visto no site de DEV em 2026-10-03, com captura de tela do usuário). É só no front: o Estado de Acesso devolvido pelo banco (`warning` com o motivo `canceled`) não muda, porque o porteiro, o Canal do Cliente e o WhatsApp dependem dele.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Teste do front (Vitest): com o Estado de Acesso `warning` e o motivo `canceled`, o layout do Gerente não mostra a faixa de aviso
- [x] Teste do front: com os motivos teste terminando, pagamento recusado e acesso liberado à mão, a faixa continua aparecendo como hoje
- [x] Teste do front: ao cancelar, aparece um toast com "Assinatura cancelada. Acesso até DD/MM." (só "Assinatura cancelada." quando não há data) que some sozinho pela duração padrão dos toasts, com timers falsos; o teste que hoje exige a faixa depois do cancelamento passa a exigir o toast
- [x] A mensagem passageira "Assinatura cancelada." no lugar do botão, enquanto a assinatura é relida, continua, e o botão não volta a ser clicável nessa janela
- [x] Nenhuma migration: o Estado de Acesso da cancelada segue o mesmo no banco
- [x] No site de DEV, a barbearia MP Teste (cancelada, com acesso até 03/11) deixa de mostrar a faixa em todas as telas do painel; Ajustes > Assinatura segue mostrando "Cancelada até DD/MM" e "Assinar de novo". O toast só se vê cancelando uma assinatura viva (novo checkout, que o usuário digita), então a prova dele fica nos testes
- [x] `rtk proxy npx oxlint src supabase/functions`, Vitest completo (rodando sozinho) e `npm run build` passam

## Resultado

Branch `fix/faixa-da-cancelada-vira-toast`, sem migration. Commit `fbbfbaa`:
- `GerenteLayout.tsx` deixa de mostrar a faixa quando o Estado de Acesso é `warning` com o motivo `canceled`; teste terminando, pagamento recusado e acesso liberado à mão seguem fixos (um teste por motivo).
- `CancelarAssinatura.tsx` mostra o toast "Assinatura cancelada. Acesso até DD/MM." (só "Assinatura cancelada." sem data) na hora do cancelamento, pela duração padrão de 4 s do `ToastProvider`, no fuso da barbearia. A mensagem passageira no lugar do botão continua.
- O texto mora em `mensagemDoCancelamento` (`mensagensDeAcesso.ts`), que `mensagemDoAviso` reaproveita para o motivo `canceled`.
- Testes com timers falsos (`shouldAdvanceTime`, margens de 1 s) e uma mutação do guard derrubou 2 testes do layout.

Revisão (`/code-review`, Standards e Spec) aplicada em 2026-10-03:
- A regra "quem tem faixa fixa" passou para o módulo de acesso: `temFaixaDeAviso(estado)` em `mensagensDeAcesso.ts`, com teste próprio; o layout só a chama.
- `CONTEXT.md` (glossário canônico) acompanhou: o verbete do Estado de Acesso e o do Cancelamento da Assinatura dizem que a cancelada não tem faixa fixa e que o aviso é o toast.
- Comentários que narravam a faixa antiga (`SecaoAssinatura.tsx`, `CancelarAssinatura.tsx`, `mensagensDeAcesso.ts`) passaram a descrever o estado atual.
- Testes: o espião de `setTimeout` é solto no `afterEach`; a tabela do `it.each` do layout ganhou a data como coluna, sem ternário.
- Mantido de propósito: o ramo `canceled` de `mensagemDoAviso` (documentado como defensivo, para a função seguir completa para qualquer motivo) e a duração de 4000 ms fixada no teste (o padrão do `ToastProvider`; se mudar, o teste muda junto). A data do toast vem de `fimDoAcessoAoCancelar(assinatura)` no cliente, e não do `dataRelevante` do banco, porque o toast sai antes de o layout reler o estado; as duas coincidem (fim do período pago ou do teste).

Gates: lint, `tsc -b`, `npm run build` e Vitest completo (168 arquivos, 2387 testes) verdes. Uma rodada anterior teve uma oscilação em `Financeiro.test.tsx` sob carga (passa isolado, 11/11, e a rodada seguinte ficou toda verde).

Pendente: no site de DEV, a barbearia MP Teste (cancelada, acesso até 03/11) deixa de mostrar a faixa; precisa de login como o Gerente dela. O toast só se vê cancelando uma assinatura viva (novo checkout), então a prova dele fica nos testes.

Critério do site de DEV cumprido em 2026-10-03, logado como o Gerente MP Teste (cancelada, acesso até 03/11): sem faixa de aviso e sem tela de bloqueio em `/agenda`, `/comandas` e `/configuracoes`; Ajustes > Assinatura mostra "Cancelada até 03/11" e o botão "Assinar de novo". O Estado de Acesso que o porteiro entrega a esse Gerente (RPC `get_my_access_state`, chamada como ele, três leituras em 21 s) foi `warning` com o motivo `canceled` e a data 03/11, ou seja, o mesmo estado em que a versão antiga mostrava a faixa: o que a tirou foi o filtro novo. O toast só aparece ao cancelar uma assinatura viva (novo checkout), então a prova dele fica nos testes, como o ticket previa.
