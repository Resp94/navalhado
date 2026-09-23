# 14: Painel de Cancelados do Dia no celular do gerente

**What to build:** o Painel de Cancelados do Dia existe para o gerente no computador e para o barbeiro nas duas larguras. No celular, o gerente não tem acesso a ele: a visão de celular da Agenda ignora as ações do cabeçalho de propósito, e o botão não foi acrescentado.

A recepção que atende com o celular na mão é exatamente quem precisa ver o que caiu do dia para tentar reocupar o horário. Hoje ela precisa de um computador para isso.

Depois deste ticket, o gerente alcança o painel no celular.

**Onde foi achado:** limite registrado no ticket 05 da spec 043, onde "cabeçalho" foi lido como computador e a decisão sobre o celular ficou explicitamente para um ticket próprio.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O gerente alcança o Painel de Cancelados do Dia na visão de celular, com o contador de cancelamentos do dia
- [ ] O painel mostra os cancelamentos de todos os profissionais da barbearia, respeitando o filtro de equipe como recorte de leitura
- [ ] A lista acompanha a troca do dia selecionado
- [ ] Nenhuma verificação de papel é acrescentada na aplicação; o recorte chega aplicado pelo banco
- [ ] O caminho de acesso no celular é decidido e registrado no ticket: a visão de celular ignora as ações do cabeçalho por desenho, então acrescentar o botão lá contraria essa decisão e precisa de justificativa, ou de outro lugar
- [ ] Os alvos de toque mantêm altura mínima de 44 pixels
- [ ] O contador e o estado ativo sinalizam por texto, ícone ou borda, nunca por fundo sólido
- [ ] Agendamento cancelado continua ausente da grade de horários do celular
- [ ] Teste de tela da visão de celular do gerente cobrindo abertura, entradas de mais de um profissional e estado vazio
- [ ] Verificado no navegador em largura de celular
- [ ] `npm run lint`, `npm test` e `npm run build` passam
