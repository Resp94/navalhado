# 02: Destinatário da gorjeta validado

**What to build:** a gorjeta de uma Comanda só pode ir para um profissional que atendeu nela. Quando só um profissional aparece nos itens, ele recebe a gorjeta automaticamente, como hoje. Quando há dois ou mais, o gestor é obrigado a escolher antes de fechar. O banco recusa destinatário fora dos itens ou de outra barbearia, e o crédito na Conta do Profissional nunca vai para profissional de outro tenant.

**Blocked by:** 01 (Preço do catálogo no fechamento de Comanda). As duas redefinem a mesma RPC de liquidação; em paralelo, uma migration sobrescreveria a outra.

**Status:** done

- [x] A RPC de liquidação recusa destinatário de gorjeta que não seja do tenant da Comanda
- [x] A RPC recusa destinatário que não aparece em nenhum Item de Comanda
- [x] Gorjeta maior que zero com dois ou mais profissionais nos itens exige destinatário
- [x] O gatilho de crédito de gorjeta confere o tenant do profissional antes de lançar na Conta do Profissional
- [x] O modal de fechamento bloqueia finalizar sem destinatário quando a escolha é obrigatória
- [x] pgTAP: destinatário de outro tenant, destinatário fora dos itens e gorjeta sem destinatário com vários profissionais, todos recusados; caso de um profissional só aceito
- [x] `npm run lint`, `npm test` e `npm run build` passam
