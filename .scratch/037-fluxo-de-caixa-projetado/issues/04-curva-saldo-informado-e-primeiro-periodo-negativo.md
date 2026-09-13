# 04: Curva, saldo informado e primeiro período negativo

**What to build:** o gestor responde à pergunta que motivou a spec: vai sobrar ou faltar dinheiro?
A aba passa a mostrar uma curva por agrupamento e destaca o primeiro período em que ela fica
negativa. Sem saldo informado, a curva é o **Resultado Acumulado** do período. Se o gestor digitar o
saldo disponível hoje, ela vira **Saldo Projetado**.

O saldo informado é entrada só de tela: nunca é gravado, enviado ao banco, posto na URL nem guardado
no navegador, para que um número digitado para simular não vire dado oficial. Saldo persistido
pertence à futura spec de subcontas e bancos. Por isso a curva é composta no navegador por uma função
pura do módulo, sem refazer a consulta a cada tecla.

O Saldo Projetado começa no agrupamento atual e soma só o fluxo pendente, porque o realizado até hoje
já está dentro do saldo informado. Agrupamentos passados não mostram saldo: reconstruir saldo passado
fingiria conhecer dinheiro que o sistema não registra. Zero é tratado como "não informado".

Este ticket só toca a tela e o módulo, e pode correr em paralelo com os tickets 02 e 03. A curva fica
mais informativa à medida que eles chegam, mas a função já é verificável com o realizado.

Aqui também nasce a ADR 021, porque com este ticket as três decisões dela estão no código.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seções "Curva: resultado acumulado ou saldo
projetado" e "Linguagem e documentação".

**Blocked by:** 01 (realizado de Comandas ponta a ponta).

**Status:** ready-for-agent

- [ ] Função pura de curva calcula o resultado de cada agrupamento como entradas realizadas +
      entradas estimadas − saídas realizadas − saídas previstas − vencidas, tratando campos ainda
      ausentes como zero.
- [ ] Sem saldo informado (zero, o padrão), a curva se chama Resultado Acumulado e é a soma corrida
      dos resultados desde o primeiro agrupamento do período.
- [ ] Com saldo maior que zero, a curva se chama Saldo Projetado, começa no agrupamento atual com
      saldo informado + fluxo pendente desse agrupamento e soma o fluxo pendente de cada agrupamento
      seguinte.
- [ ] Agrupamentos passados não têm saldo projetado.
- [ ] O realizado de hoje não é somado ao saldo informado.
- [ ] A função devolve o primeiro agrupamento com curva negativa.
- [ ] O rótulo troca entre Resultado Acumulado e Saldo Projetado quando o saldo passa de zero para um
      valor informado e volta.
- [ ] Campo "Saldo disponível hoje (opcional)" nos filtros aceita valor maior ou igual a zero, lido
      pelo mesmo parser de moeda do projeto, e não aparece num período inteiramente passado.
- [ ] O saldo informado não é gravado, não é enviado ao banco, não vai para a URL e não é guardado em
      armazenamento do navegador.
- [ ] Destaque do primeiro período negativo com texto adequado ao rótulo: "saldo projetado negativo a
      partir de..." ou "resultado acumulado negativo a partir de...".
- [ ] Resumo ganha o cartão de valor ao fim do período, e a tabela e os cartões de celular mostram a
      curva por agrupamento.
- [ ] Testes de módulo da função de curva: acumulado sem saldo, saldo projetado começando no
      agrupamento atual, agrupamentos passados sem saldo, realizado de hoje não somado ao saldo,
      primeiro agrupamento negativo e troca de rótulo entre zero e valor informado.
- [ ] Teste da aba com repositório falso injetado cobre o campo de saldo trocando o rótulo da curva.
- [ ] ADR 021 escrita, registrando três decisões: o fluxo lê livros de origem e nunca movimentos de
      caixa; a entrada futura é estimada pela média por dia da semana, sem persistência; o saldo
      inicial é só de tela.
- [ ] `CONTEXT.md` ganha os termos Resultado Acumulado e Saldo Projetado.
- [ ] `npm run test` verde.
