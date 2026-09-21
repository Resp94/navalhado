# 04: Barbeiro vê o Painel de Cancelados do Dia

**What to build:** primeiro tracer bullet visível da parte de cancelamento. Hoje o barbeiro é obrigado a escrever um motivo ao cancelar pela Minha Agenda, e esse texto some da interface no instante seguinte; quando é o cliente que desmarca pelo Canal do Cliente, o barbeiro não fica sabendo por quê. Depois deste ticket, a Minha Agenda ganha um painel que lista os Agendamentos cancelados do dia selecionado, com o motivo por extenso — tanto o que o próprio barbeiro escreveu quanto o que o cliente deixou.

A grade de horários continua sem exibir Agendamento cancelado: o slot está livre e deve continuar lendo como disponível.

O painel nasce aqui como componente que recebe a lista por propriedade e não busca dados, para ser reusado pela Agenda do gerente no ticket 05.

Recorte de acesso: o barbeiro alcança apenas os Agendamentos do próprio profissional, e isso é garantido pela política de leitura da tabela, não pelo componente. A política não condiciona por status, então vale igual para cancelado.

**Blocked by:** 03 (Agenda do gerente lê Agendamento pelo repositório) — o contrato de leitura é mexido nos dois, e o 03 é o prefactor que deixa esse contrato num lugar só

**Status:** ready-for-agent

- [ ] O contrato de carregamento de agenda do dia ganha sinalizador de cancelados, desligado por padrão
- [ ] Desligado, a consulta segue como hoje e o retorno não traz coleção de cancelados preenchida
- [ ] Ligado, os cancelados voltam em coleção própria, separada da coleção de ativos
- [ ] O tipo de Agendamento do dia carrega o Motivo de Cancelamento, opcional e nulo fora do contexto de cancelamento
- [ ] O adaptador real e o adaptador em memória implementam as duas mudanças
- [ ] Nasce o Painel de Cancelados do Dia, recebendo a lista por propriedade; o componente não busca dados e não verifica papel
- [ ] O painel usa apenas componentes já catalogados na biblioteca de interface; nenhum componente novo é criado
- [ ] A Minha Agenda abre o painel por um controle no cabeçalho, com contador de cancelamentos do dia
- [ ] Cada entrada mostra horário original, cliente, serviço, profissional e o motivo por extenso
- [ ] Entrada cujo cliente não escreveu motivo exibe o texto padrão gravado, nunca espaço em branco
- [ ] Estado vazio claro quando nada foi cancelado no dia, distinguível de falha de carregamento
- [ ] A lista acompanha a troca do dia selecionado
- [ ] Agendamento cancelado continua ausente da grade de horários
- [ ] O contador e o estado ativo sinalizam por texto, ícone ou borda, nunca por fundo sólido; no máximo um botão primário dentro do painel
- [ ] Em telas pequenas os alvos de toque mantêm altura mínima de 44 pixels
- [ ] Teste do repositório: sem pedir cancelados a coleção de ativos permanece idêntica ao comportamento atual; pedindo cancelados eles chegam na coleção própria e continuam fora da de ativos; o motivo sobrevive da escrita até a leitura; o limite superior do intervalo continua exclusivo para cancelado como já é para ativo
- [ ] O teste do repositório não afirma escopo de acesso: o adaptador em memória não reproduz a política do banco e não tem autoridade para isso
- [ ] Teste de tela do barbeiro: abertura do painel, motivo renderizado por extenso, estado vazio, e ausência de cancelado na grade
- [ ] pgTAP: barbeiro lendo Agendamento cancelado alcança apenas os do próprio profissional; não alcança o de colega da mesma barbearia; continua assim mesmo sem restringir por profissional na consulta
- [ ] `npm run lint`, `npm test` e `npm run build` passam
