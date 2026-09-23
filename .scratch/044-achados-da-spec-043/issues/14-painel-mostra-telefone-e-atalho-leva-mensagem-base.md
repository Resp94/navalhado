# 14: Painel de Cancelados mostra o telefone e o atalho de WhatsApp leva mensagem-base

**What to build:** o Painel de Cancelados do Dia tem um atalho para falar com o cliente no WhatsApp, pensado para tentar reocupar o horário. Ele abre a conversa vazia. Todo o resto do sistema que abre o WhatsApp leva um texto pronto.

Quem usa o atalho tem que escrever do zero, na pressa da recepção, justamente a mensagem mais repetitiva do dia.

Além disso, a história 3 da spec 043 pedia que cada entrada mostrasse o nome e o telefone do cliente, para contatá-lo sem procurar em outra tela. O painel entregue mostra o nome e o botão de WhatsApp, mas não o telefone. Quem vai ligar, ou quem está num aparelho sem WhatsApp, não tem o número.

Depois deste ticket, a entrada mostra o telefone, e o atalho abre a conversa com uma mensagem-base que a recepção edita antes de enviar.

**Onde foi achado:** limite registrado no ticket 05 da spec 043 (mensagem), e história 3 da spec 043 não atendida pelo painel entregue (telefone), apontada na auditoria de cobertura da spec 044.

**Blocked by:** 03 (Tipo do cliente do Agendamento aceita nulo) — o telefone e o atalho precisam tratar o Agendamento sem Cliente, e o 03 faz a verificação de tipos apontar onde

**Status:** done

- [x] Cada entrada do painel mostra o telefone do cliente
- [x] Agendamento cancelado sem Cliente, ou com Cliente sem telefone, mostra a ausência de forma limpa, sem rótulo vazio
- [x] O atalho abre a conversa do WhatsApp com uma mensagem-base preenchida
- [x] A mensagem cita o horário que vagou e o nome da barbearia, e não afirma nada que o sistema não saiba
- [x] A mensagem não é enviada pelo sistema; ela chega como rascunho para a recepção revisar e enviar
- [x] O texto segue o vocabulário do glossário do projeto e o tom das demais mensagens ao cliente
- [x] O atalho continua indisponível quando o Agendamento cancelado não tem Cliente ou telefone
- [x] O atalho continua abrindo em nova aba sem dar à página aberta acesso à janela de origem
- [x] Vale para o painel do gerente e para o do barbeiro, se o do barbeiro tiver o atalho
- [x] Teste de tela conferindo que o destino do atalho leva o telefone e o texto
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Um só ponto de correção**, como nos tickets anteriores desta spec: `PainelCanceladosDoDia.tsx` é compartilhado pela Agenda Geral do gerente e pela Minha Agenda do barbeiro. A exibição do telefone entrou ali. Já o atalho de WhatsApp (`onContatarCliente`) só existia no gerente — a Minha Agenda do barbeiro nunca passou essa prop, então não tem (nem tinha) o atalho; o critério "vale para os dois, se o do barbeiro tiver o atalho" não se aplica a ele hoje, e não criei um atalho novo ali, fora do pedido do ticket.
- **Telefone**: nova linha "Telefone:" em cada entrada, com `maskPhone` da `lib/whatsapp.ts` (o mesmo formatador usado no resto do sistema). Sem Cliente (encaixe de balcão) ou com Cliente sem telefone cadastrado, mostra o texto `Sem telefone` (constante `TELEFONE_NAO_INFORMADO`) em vez de um valor vazio — mesmo padrão já usado para motivo ausente (`MOTIVO_NAO_INFORMADO`).
- **Mensagem-base**: montada em `Agenda.tsx` (gerente), no `onContatarCliente` passado ao painel, e passada para `openWhatsApp(phone, mensagem)` — a mesma função de `lib/whatsapp.ts` que todo o resto do sistema usa para abrir o WhatsApp com texto pronto (`handleDirectWhatsApp` já fazia isso para confirmação de horário; segui o mesmo estilo de template embutido em vez do dicionário `WHATSAPP_TEMPLATES`, que hoje só serve para retorno e agradecimento). Texto: `Olá {nome}! O horário das {horário} ficou livre na {barbearia}. Quer remarcar?` — cita só o que o sistema sabe (nome do cliente, horário do Agendamento cancelado, nome da barbearia); não afirma quem cancelou nem o motivo, e não presume que o cliente vai aceitar.
- **Rascunho, não envio automático**: `openWhatsApp` só monta a URL `wa.me` e abre; quem envia é a recepção, depois de revisar o texto no próprio WhatsApp Web/app. Nenhuma chamada a `sendManualWhatsAppMessage` ou à Edge Function entrou neste ticket.
- **Nova aba sem `opener`**: comportamento inalterado, `openWhatsApp` já chama `window.open(url, '_blank', 'noopener,noreferrer')` — não mexi nisso.
- **Atalho continua indisponível sem Cliente ou telefone**: `disabled={!cancelado.customer?.phone?.trim()}` no botão não mudou; o novo `onContatarCliente` de `Agenda.tsx` também devolve cedo (`if (!phone) return`) como defesa em profundidade, já que o clique no botão desabilitado não dispara `onClick` mesmo assim.
- **Vermelho provado por mutação**: troquei os dois arquivos tocados (`PainelCanceladosDoDia.tsx`, `Agenda.tsx`) pela versão de antes do ticket (`git show dev:...`) e rodei `Agenda.test.tsx` — os 2 testes novos (telefone visível/ausente, e mensagem-base com nome/horário/barbearia) falharam como esperado, os outros 55 continuaram verdes. Restaurados os arquivos corrigidos, os 57 voltam a passar.
- Testes novos/alterados em `src/pages/__tests__/Agenda.test.tsx` (describe "Painel de Cancelados do Dia"): o teste existente do atalho de WhatsApp passou a decodificar o `?text=` da URL e conferir nome, horário e nome da barbearia na mensagem, em vez de só checar o número; teste novo cobrindo telefone mascarado numa entrada com Cliente, `Sem telefone` numa entrada com Cliente sem telefone e numa de encaixe de balcão sem Cliente, tudo na mesma renderização.
- Suíte completa: 110 arquivos, 1210 testes (+1 deste ticket). `npx tsc -b`: 0 erros (um erro de tipo em `new URL(url)` no teste, por `url` poder ser `undefined` no tipo do mock do Vitest, corrigido com um cast explícito do valor já conferido não-undefined pela asserção anterior). `npx oxlint`: exit 0 (avisos pré-existentes em arquivos não tocados). `npm run build`: build 0.
- **Flake pré-existente, não causado por este ticket**: a primeira rodada da suíte completa com as mudanças aplicadas falhou 1 teste em `MinhaAgenda.test.tsx` (`Unable to find an element with the text: 11988887777`), num arquivo que este ticket não toca. Isolado: `npx vitest run` só desse arquivo passa sempre. Testado o inverso — suíte completa em `dev` limpo (mudanças no stash) — passou 110/110 limpo; suíte completa de novo com as mudanças aplicadas também passou 110/110. Concluído que é flake de concorrência entre arquivos de teste (não reproduzível de forma determinística), preexistente à spec 044, fora do escopo deste ticket.
- Sem migration: mudança só de código de aplicação. Contagens do banco no ambiente de desenvolvimento inalteradas (nenhuma leitura/escrita de banco no fluxo tocado).
