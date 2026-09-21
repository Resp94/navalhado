# 04: Barbeiro vê o Painel de Cancelados do Dia

**What to build:** primeiro tracer bullet visível da parte de cancelamento. Hoje o barbeiro é obrigado a escrever um motivo ao cancelar pela Minha Agenda, e esse texto some da interface no instante seguinte; quando é o cliente que desmarca pelo Canal do Cliente, o barbeiro não fica sabendo por quê. Depois deste ticket, a Minha Agenda ganha um painel que lista os Agendamentos cancelados do dia selecionado, com o motivo por extenso — tanto o que o próprio barbeiro escreveu quanto o que o cliente deixou.

A grade de horários continua sem exibir Agendamento cancelado: o slot está livre e deve continuar lendo como disponível.

O painel nasce aqui como componente que recebe a lista por propriedade e não busca dados, para ser reusado pela Agenda do gerente no ticket 05.

Recorte de acesso: o barbeiro alcança apenas os Agendamentos do próprio profissional, e isso é garantido pela política de leitura da tabela, não pelo componente. A política não condiciona por status, então vale igual para cancelado.

**Blocked by:** 03 (Agenda do gerente lê Agendamento pelo repositório) — o contrato de leitura é mexido nos dois, e o 03 é o prefactor que deixa esse contrato num lugar só

**Status:** done

- [x] O contrato de carregamento de agenda do dia ganha sinalizador de cancelados, desligado por padrão
- [x] Desligado, a consulta segue como hoje e o retorno não traz coleção de cancelados preenchida
- [x] Ligado, os cancelados voltam em coleção própria, separada da coleção de ativos
- [x] O tipo de Agendamento do dia carrega o Motivo de Cancelamento, opcional e nulo fora do contexto de cancelamento
- [x] O adaptador real e o adaptador em memória implementam as duas mudanças
- [x] Nasce o Painel de Cancelados do Dia, recebendo a lista por propriedade; o componente não busca dados e não verifica papel
- [x] O painel usa apenas componentes já catalogados na biblioteca de interface; nenhum componente novo é criado
- [x] A Minha Agenda abre o painel por um controle no cabeçalho, com contador de cancelamentos do dia
- [x] Cada entrada mostra horário original, cliente, serviço, profissional e o motivo por extenso
- [x] Nunca deixa o motivo em branco: o texto gravado aparece como está, inclusive o padrão que o Canal do Cliente grava quando o cliente não escreve nada, e motivo nulo (registros antigos) mostra "Sem motivo informado" (ver Verificação)
- [x] Estado vazio claro quando nada foi cancelado no dia, distinguível de falha de carregamento
- [x] A lista acompanha a troca do dia selecionado
- [x] Agendamento cancelado continua ausente da grade de horários
- [x] O contador e o estado ativo sinalizam por texto, ícone ou borda, nunca por fundo sólido; no máximo um botão primário dentro do painel
- [x] Em telas pequenas os alvos de toque mantêm altura mínima de 44 pixels
- [x] Teste do repositório: sem pedir cancelados a coleção de ativos permanece idêntica ao comportamento atual; pedindo cancelados eles chegam na coleção própria e continuam fora da de ativos; o motivo sobrevive da escrita até a leitura; o limite superior do intervalo continua exclusivo para cancelado como já é para ativo
- [x] O teste do repositório não afirma escopo de acesso: o adaptador em memória não reproduz a política do banco e não tem autoridade para isso
- [x] Teste de tela do barbeiro: abertura do painel, motivo renderizado por extenso, estado vazio, e ausência de cancelado na grade
- [x] pgTAP: barbeiro lendo Agendamento cancelado alcança apenas os do próprio profissional; não alcança o de colega da mesma barbearia; continua assim mesmo sem restringir por profissional na consulta
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Verificação (2026-09-21):**

- Suíte completa: 109 arquivos, 1154 testes, exit 0. Lint e build saem 0. Depois disso foram alterados o botão de fechar do `Drawer` e acrescentado um teste (troca de dia); foram refeitos os testes do barbeiro, da biblioteca de interface, do módulo de agenda e do financeiro, além de `tsc` e lint. A suíte completa não foi repetida depois dessas duas mudanças.
- Testes: repositório contra o adaptador em memória, adaptador real com um banco falso que aplica filtros, ordem e colunas do `select`, e a página do barbeiro, cujo fake agora aplica `eq` e `neq` de verdade. O vermelho foi provado em cada ciclo; a mutação de tirar o motivo do `select` e a de anular a leitura dos cancelados na página derrubam testes.
- pgTAP `51_barbeiro_le_cancelados_do_proprio_profissional`: 7/7 pelo servidor MCP no ambiente de desenvolvimento, dentro de `begin; ... rollback;`. Inclui um caso de controle (o barbeiro alcança o próprio Agendamento ativo), para que os zeros não sejam vácuos.
- Navegador, como barbeiro, no ambiente de desenvolvimento: o painel exibiu horário, cliente, serviço, profissional e motivo; o dia seguinte exibiu "Cancelados 0" e o estado vazio; o console ficou sem erros.
- Recorte provado de ponta a ponta: com um cancelado de um colega inserido no banco (2 cancelados no dia), o barbeiro continuou vendo só 1, sem o texto do colega em lugar nenhum. Esse cancelado, mais 2 notificações e 1 comanda criadas por gatilhos, foram apagados pelos ids, e as contagens voltaram às originais.
- Toque, em 375 px com ponteiro grosso: o botão "Cancelados" tinha 44 px e o botão de fechar do `Drawer` passou de 32 por 32 para 44 por 44. Como o jsdom não calcula isso, a prova é a medição no navegador. A correção é do componente compartilhado, em commit próprio, e as suítes das 8 telas do financeiro que o usam seguem verdes.

**Desvios e limites:**

- O texto padrão `Cancelado pelo cliente` é montado no front, no adaptador do Canal do Cliente, e não no banco como a spec afirmava. O critério foi reescrito para o comportamento real. Motivo nulo só ocorre em registros antigos, e para eles o painel mostra "Sem motivo informado".
- "Nenhum componente novo" foi lido como nenhum componente novo na biblioteca de interface: o painel é um componente de agenda que usa `Drawer`, `EmptyState` e `Badge`.
- O contador some quando a leitura falha, em vez de mostrar 0, para não afirmar um número que não se sabe.
- A função que interpreta as colunas do `select` nos bancos falsos existe agora em dois arquivos de teste (clientes e agenda). Não foi extraída por serem só duas cópias.
- Cancelamento pelo Canal do Cliente não foi exercitado de ponta a ponta no navegador; o motivo exibido veio de um Agendamento já existente no ambiente.
