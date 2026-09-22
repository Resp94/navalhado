# 15: Painel de Cancelados do Dia no celular do gerente

**What to build:** o Painel de Cancelados do Dia existe para o gerente no computador e para o barbeiro nas duas larguras. No celular, o gerente não tem acesso a ele: a visão de celular da Agenda ignora as ações do cabeçalho de propósito, e o botão não foi acrescentado.

A recepção que atende com o celular na mão é exatamente quem precisa ver o que caiu do dia para tentar reocupar o horário. Hoje ela precisa de um computador para isso.

Depois deste ticket, o gerente alcança o painel no celular.

**Onde foi achado:** limite registrado no ticket 05 da spec 043, onde "cabeçalho" foi lido como computador e a decisão sobre o celular ficou explicitamente para um ticket próprio.

**Blocked by:** 04 (Extrair a repetição entre a Agenda Geral e a Minha Agenda) — o painel no celular reusa o estado extraído pelo 04

**Status:** done

- [x] Decidido em 2026-09-22: o gerente abre o Painel de Cancelados do Dia no celular por uma faixa discreta acima da grade da visão do dia, com o número de cancelamentos do dia; o cabeçalho do celular não muda
- [x] A faixa aparece quando há cancelamento no dia ou quando a leitura dos cancelados falha, e some nos demais casos
- [x] Falha na leitura dos cancelados é sinalizada na faixa, distinguível de dia sem cancelamento
- [x] O painel mostra os cancelamentos de todos os profissionais da barbearia, respeitando o filtro de equipe como recorte de leitura
- [x] A lista acompanha a troca do dia selecionado
- [x] Nenhuma verificação de papel é acrescentada na aplicação; o recorte chega aplicado pelo banco
- [x] Os alvos de toque mantêm altura mínima de 44 pixels
- [x] A faixa sinaliza por texto, ícone ou borda, nunca por fundo sólido, e não empurra a grade de forma que esconda o primeiro horário
- [x] Agendamento cancelado continua ausente da grade de horários do celular
- [x] Teste de tela da visão de celular do gerente cobrindo a faixa presente com cancelamento, ausente sem cancelamento, a falha de leitura, a abertura do painel e entradas de mais de um profissional
- [x] Verificado no navegador em largura de celular
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Design escolhido**: faixa full-width, altura mínima 44px (`min-h-11`), acima da linha do tempo cronológica em `MobileAgendaView.tsx`, logo depois da faixa de erro de Bloqueios (ticket 11) — as duas empilham, nenhuma esconde a grade. Sinaliza por ícone + texto + borda (`border`), nunca fundo sólido: tokens `bg-info-bg/text-info/border-info` (mesmos do `Badge` variante `info` subtle) no caso normal, `bg-warning-bg/text-warning/border-warning` (mesmos da faixa de erro do ticket 11) no caso de falha. A faixa inteira é um `<button>` que chama `abrirCancelados`, então o alvo de toque é a faixa toda, não um botão pequeno dentro dela.
- **Reuso do estado extraído no ticket 04**: `canceladosDoDia` (contagem já filtrada por dia e pelo filtro de equipe — mesma lógica usada pelo botão "Cancelados" do desktop) e `canceladosComErro`/`abrirCancelados` do hook `useCanceladosDoDia` são passados para `MobileAgendaView` via uma prop nova `cancelamentosDoDia={{ quantidade, comErro, onAbrir }}`, opcional. O painel (`PainelCanceladosDoDia`) já era renderizado uma vez só em `Agenda.tsx`, fora da divisão mobile/desktop — abrir pela faixa ou pelo botão do cabeçalho abre o mesmo painel, com o mesmo estado.
- **Escopo só do gerente**: a prop é opcional; só `Agenda.tsx` (gerente) a passa. `MinhaAgenda.tsx` (barbeiro) continua sem passá-la, então a Minha Agenda não ganha a faixa — o título do ticket já delimitava "no celular do gerente".
- **Sem verificação de papel nova**: a contagem e a lista vêm de `canceladosDoDia`, que já existia (ticket 05 da spec 043) recortado pelo banco; a faixa só decide quando aparecer e o que abrir, não filtra por conta própria.
- **Grade sem o cancelado**: a lista de timeline (`timelineItems`) continua vindo só de `appointments`/`blockedSlots`; `cancelados` nunca entra nela — comportamento já garantido antes deste ticket, não tocado aqui.
- **Vermelho provado por mutação**: troquei `MobileAgendaView.tsx` e `Agenda.tsx` pela versão de antes do ticket (`git show dev:...`) e rodei o describe novo — 5 dos 6 testes falharam (o único que passou foi o de "some quando não há cancelamento", correto contra código antigo, que também não tem a faixa). Restaurados os arquivos corrigidos, os 6 voltam a passar, e o arquivo inteiro continua com 63/63.
- Teste novo em `src/pages/__tests__/Agenda.test.tsx`, describe "faixa de Cancelados do Dia na visão de celular": ausência sem cancelamento, presença com contagem (plural e singular), falha de leitura distinguível ("Não foi possível carregar os cancelamentos do dia." vs. "N cancelamento(s) no dia. Toque para ver."), abertura do painel pela faixa com entradas de mais de um profissional, e acompanhamento da troca de dia.
- **Verificado no navegador** (atualização 2026-09-22, sessão de gerente já autenticada aberta pelo usuário na aba compartilhada): largura 375px, dia de hoje sem cancelamento — faixa ausente, confirmando o estado padrão. Criado um encaixe de balcão (sem cliente cadastrado, sem telefone, para não gerar nenhum efeito colateral de WhatsApp) e cancelado pela própria tela (`Cancelar atendimento`, motivo "Teste ticket 15 (spec 044)"): a faixa apareceu imediatamente com "1 cancelamento no dia. Toque para ver.", nos tokens `info` (sem fundo sólido). Toquei na faixa: abriu o mesmo Painel de Cancelados do Dia, com a entrada mostrando "Cliente Balcão", telefone "Sem telefone" (ticket 14) e o selo "Barbearia" em `Cancelado por` (ticket 13) — confirmando que a faixa nova abre o painel já corrigido pelos tickets anteriores da spec, sem regressão. Viewport revertido para desktop ao final.
- Suíte completa: 110 arquivos, 1216 testes (+6 deste ticket). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0 (avisos pré-existentes em arquivos não tocados). `npm run build`: build 0.
- Sem migration: mudança só de código de aplicação (frontend). Nenhuma leitura/escrita de banco nova.
