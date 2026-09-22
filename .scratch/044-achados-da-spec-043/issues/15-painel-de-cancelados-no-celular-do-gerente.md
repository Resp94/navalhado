# 15: Painel de Cancelados do Dia no celular do gerente

**What to build:** o Painel de Cancelados do Dia existe para o gerente no computador e para o barbeiro nas duas larguras. No celular, o gerente não tem acesso a ele: a visão de celular da Agenda ignora as ações do cabeçalho de propósito, e o botão não foi acrescentado.

A recepção que atende com o celular na mão é exatamente quem precisa ver o que caiu do dia para tentar reocupar o horário. Hoje ela precisa de um computador para isso.

Depois deste ticket, o gerente alcança o painel no celular.

**Onde foi achado:** limite registrado no ticket 05 da spec 043, onde "cabeçalho" foi lido como computador e a decisão sobre o celular ficou explicitamente para um ticket próprio.

**Blocked by:** 04 (Extrair a repetição entre a Agenda Geral e a Minha Agenda) — o painel no celular reusa o estado extraído pelo 04

**Status:** ready-for-agent

- [ ] Decidido em 2026-09-22: o gerente abre o Painel de Cancelados do Dia no celular por uma faixa discreta acima da grade da visão do dia, com o número de cancelamentos do dia; o cabeçalho do celular não muda
- [ ] A faixa aparece quando há cancelamento no dia ou quando a leitura dos cancelados falha, e some nos demais casos
- [ ] Falha na leitura dos cancelados é sinalizada na faixa, distinguível de dia sem cancelamento
- [ ] O painel mostra os cancelamentos de todos os profissionais da barbearia, respeitando o filtro de equipe como recorte de leitura
- [ ] A lista acompanha a troca do dia selecionado
- [ ] Nenhuma verificação de papel é acrescentada na aplicação; o recorte chega aplicado pelo banco
- [ ] Os alvos de toque mantêm altura mínima de 44 pixels
- [ ] A faixa sinaliza por texto, ícone ou borda, nunca por fundo sólido, e não empurra a grade de forma que esconda o primeiro horário
- [ ] Agendamento cancelado continua ausente da grade de horários do celular
- [ ] Teste de tela da visão de celular do gerente cobrindo a faixa presente com cancelamento, ausente sem cancelamento, a falha de leitura, a abertura do painel e entradas de mais de um profissional
- [ ] Verificado no navegador em largura de celular
- [ ] `npm run lint`, `npm test` e `npm run build` passam
