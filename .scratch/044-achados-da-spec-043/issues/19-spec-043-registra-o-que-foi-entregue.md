# 19: Spec 043 registra o que foi entregue

**What to build:** a spec 043 descreve, em sete pontos, um sistema diferente do que foi entregue. Os tickets dela já registram o comportamento real, mas quem ler só a spec vai procurar regra no lugar errado:

- A spec afirma que o banco grava o texto padrão `Cancelado pelo cliente` quando o cliente não escreve motivo. Quem monta esse texto é o adaptador do Canal do Cliente, no front, antes de chamar o banco.
- A spec fala em três funções de cancelamento. São quatro: a que cancela a Comanda e o Agendamento juntos também grava a autoria.
- A spec diz que as consultas de Bloqueios de Horário da Agenda Geral não seriam tocadas. O ticket 08 da spec 043 dividiu o contrato de leitura em Agendamentos e Bloqueios.
- A spec trata a marca de Agendamento vindo da Lista de Espera como o marcador genérico de origem na nota, e o ticket 07 original da spec 043 propunha um valor novo na origem. Foi entregue uma coluna própria, a nota passou a levar só a observação, e a origem não mudou.
- A spec diz que a autoria é escrita exclusivamente pelas funções de cancelamento. A aplicação respeita isso, mas o banco não impede a escrita direta pelo gerente.
- A spec previa testes de autoria no repositório de agenda. Eles foram substituídos por pgTAP contra as funções reais, porque no repositório passariam por construção.
- A spec diz que o painel não cria componente novo. Isso foi lido como nenhum componente novo na biblioteca de interface: o painel é um componente de agenda que usa os da biblioteca.

Depois deste ticket, a spec diz o que foi feito sem apagar o que foi decidido.

**Onde foi achado:** desvios registrados nos tickets 04, 06, 07 e 08 da spec 043, e confronto das decisões 1 e 7 e da seção de testes da spec 043 com o que foi entregue.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Cada um dos sete pontos recebe uma nota de estado de entrega, com data, ao lado do texto original; o texto original não é apagado
- [x] A nota sobre o texto padrão diz onde ele é montado e que o cancelamento sem motivo existe nos registros antigos, exibido como "Sem motivo informado"
- [x] A nota sobre as funções de cancelamento nomeia a quarta via e diz que ela grava autoria mas não motivo, apontando para o ticket 07 da spec 044, que resolve isso
- [x] A nota sobre Bloqueios aponta para o ticket 08 da spec 043 e descreve o contrato dividido
- [x] A nota sobre a Lista de Espera descreve a coluna própria e aponta para o ticket 17 da spec 044, que leva a medida ao relatório
- [x] A nota sobre a escrita da autoria aponta para o ticket 08 da spec 044, que a protege no banco
- [x] As notas sobre os testes de autoria e sobre o componente registram a leitura adotada e a razão
- [x] Toda outra afirmação da spec que for alterada é conferida contra o código antes
- [x] Os tickets da spec 043 não são alterados
- [x] A correção é de documentação: nenhum arquivo de código é tocado

**Resultado (2026-09-22):**

- Seis blocos de nota (`> **Nota de entrega (2026-09-22, spec 044, ticket 19):**`) inseridos em `specs/043-motivo-de-cancelamento-visivel/spec.md`, cobrindo os sete pontos do ticket (dois pontos — funções de cancelamento e escrita da autoria — compartilham um só bloco, sob a decisão 1, onde os dois assuntos já estavam juntos no texto original):
  1. Após Parte 1, item 2 (texto padrão): quem monta o texto é o adaptador do Canal do Cliente (`MOTIVO_CANCELAMENTO_PADRAO_CLIENTE`, `src/modules/canal-cliente/types.ts`), não o banco; cancelamento sem motivo anterior a essa distinção mostra "Sem motivo informado", nunca o texto padrão.
  2. Após Parte 2, item 9 (Lista de Espera): o "marcador genérico de origem" era o prefixo `[Fila de Espera]` na nota, não a coluna `origin`; o ticket 07 da própria spec 043 propôs originalmente um valor novo em `origin` mas a decisão registrada nesse ticket mudou para coluna booleana própria (`from_waiting_list`) antes da entrega; aponta para o ticket 17 da spec 044 (relatório).
  3. Após a Decisão 1 (autoria no banco): nomeia a quarta via (`cancel_comanda_appointment`, cancelamento pela tela de Comandas), que grava autoria mas não motivo — aponta o ticket 07 da spec 044, que fechou essa lacuna; e registra que "escrita exclusivamente pelas RPCs" era comportamento da aplicação, não do banco, até o ticket 08 da spec 044 revogar a escrita direta.
  4. Após a Decisão 3 (migração da Agenda do gerente): Bloqueios de Horário acabou tocada, mas pelo ticket 08 da própria spec 043 (que dividiu a leitura conjunta em duas consultas separadas por outro motivo — isolamento de falha), não pela migração para o repositório, que de fato não tocou Bloqueios.
  5. Nos casos de teste da costura principal (autoria no repositório): os três casos de autoria (barbearia/cliente/nula) foram substituídos por pgTAP contra as RPCs reais — no adaptador em memória seriam afirmação por construção, sem uma RPC real gravando o valor.
  6. Na Decisão 7 (Design System): "sem componente novo" foi lido como sem componente novo na biblioteca de interface (`src/components/ui`) — o painel em si (`PainelCanceladosDoDia`, `src/components/agenda/`) é um componente novo de domínio da Agenda, montado só com peças já catalogadas.
- Cada citação (nome de arquivo, constante, função, ticket) conferida contra o código ou o ticket real antes de escrever: `MOTIVO_CANCELAMENTO_PADRAO_CLIENTE` existe em `src/modules/canal-cliente/types.ts` (ticket 16 desta spec); `cancel_comanda_appointment` existe em `supabase/migrations/20260911161000_code_review_cancelamento_atomico_agendamento_comanda.sql`; `PainelCanceladosDoDia.tsx` existe em `src/components/agenda/`; o ticket 07 da spec 043 (`.scratch/043-motivo-de-cancelamento-visivel/issues/07-...md`) de fato propõe valor novo em `origin` no "What to build" e corrige para coluna própria na "Decisão registrada" do mesmo arquivo.
- **Nenhum arquivo de código tocado**: `git status` confirma que só `specs/043-motivo-de-cancelamento-visivel/spec.md` mudou.
- **Nenhum ticket da spec 043 alterado**: nada em `.scratch/043-motivo-de-cancelamento-visivel/issues/` foi tocado — as citações a esses arquivos são só referência.
- `npx tsc -b` e `npx oxlint`: sem mudança de código, seguem 0 erros / exit 0 (checagem de sanidade, já que a mudança é só de markdown). Ticket não lista `npm run lint`/`npm test`/`npm run build` no critério de aceite, coerente com ser trabalho só de documentação.
