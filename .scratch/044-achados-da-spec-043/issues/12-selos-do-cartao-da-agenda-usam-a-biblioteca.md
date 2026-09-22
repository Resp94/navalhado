# 12: Selos do cartão da Agenda usam o componente da biblioteca

**What to build:** o cartão do Agendamento na Agenda carrega vários selos: Encaixe, Pago, Não compareceu e, desde a spec 043, Espera. O selo novo usa o componente de selo da biblioteca de interface, em variante sutil. Os antigos são marcação solta, com fundo sólido e cores escritas à mão em hexadecimal, fora dos tokens.

O resultado é um cartão com dois vocabulários visuais lado a lado, e cores que não respondem ao tema. É o débito de design system já catalogado, agora visível no mesmo cartão.

Depois deste ticket, os selos do cartão falam a mesma língua.

**Onde foi achado:** limite registrado no ticket 07 da spec 043. A observação de que o selo "Espera" fica apertado nos cartões pequenos da visão semanal foi feita durante a verificação no navegador daquele ticket e não chegou ao arquivo dele. O rótulo curto "Espera" substituiu o "Lista de Espera" que o ticket 07 original da spec 043 prometia.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Os selos do cartão do Agendamento passam a usar o componente de selo da biblioteca de interface
- [ ] Nenhuma cor escrita em hexadecimal permanece nos selos; as cores vêm de tokens
- [ ] Nenhum selo usa fundo sólido com texto branco, a menos que use o par de tokens sólidos previsto para isso
- [ ] Vale para a grade do dia, a grade da semana e a visão de celular, que a Minha Agenda do barbeiro também usa
- [ ] Cada selo continua distinguível dos outros à primeira vista; o ticket não é uma uniformização que apague a diferença entre Encaixe e Pago
- [ ] O espaço ocupado pelos selos não estoura o cartão nas grades menores, conferido na visão semanal e em tela de 375 pixels
- [ ] O rótulo do selo da Lista de Espera, hoje "Espera", é conferido quanto à clareza para quem não conhece a origem do Agendamento; se mudar, muda nas três superfícies e nos testes
- [ ] Os testes de tela que hoje procuram esses selos continuam verdes, ajustados ao novo texto acessível se ele mudar
- [ ] Verificado no navegador, com um Agendamento que carregue mais de um selo ao mesmo tempo
- [ ] `npm run lint`, `npm test` e `npm run build` passam
