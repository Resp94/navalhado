# 05: Compromissos sem Data

**What to build:** o gestor passa a ver, numa linha própria, quanto a barbearia deve hoje à equipe
entre comissões e gorjetas em aberto, já descontados os vales a abater. É dinheiro comprometido que
hoje não aparece junto do resto.

Os **Compromissos sem Data** não são distribuídos entre os períodos nem entram na curva: distribuí-los
exigiria inventar uma data de quitação, e quando quitar é decisão do gestor. O resumo mostra o valor
ao fim do período e o mesmo valor depois dos Compromissos sem Data.

O total é a soma, por profissional, do líquido sugerido que a própria Quitação de Comissão exibe e
liquida (comissão em aberto com legado, mais gorjetas em aberto, menos vales em aberto, com piso zero
por profissional). Reusar o contrato por profissional garante que a linha do fluxo e as telas de
quitação nunca divirjam. O contrato de saldo do tenant não serve: cobre só comissão, compensa
profissionais entre si no legado e conta como pago o legado de quitações estornadas. O piso por
profissional impede que o vale de um esconda o crédito de outro; profissionais inativos e arquivados
entram, para que a dívida com ex-profissional não suma.

**Cadeia sequencial:** este ticket redefine a mesma função de leitura do fluxo que os tickets 01, 02,
03, 07 e 08. Não pode correr em paralelo com outro ticket da cadeia.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seção "Compromissos sem Data".

**Blocked by:** 03 (entradas estimadas por dia da semana), 04 (curva, saldo informado e primeiro
período negativo).

**Status:** ready-for-agent

- [ ] Contrato devolve Compromissos sem Data com comissões em aberto, gorjetas em aberto, vales a
      abater e líquido devido, calculados no momento da consulta.
- [ ] O líquido devido é igual à soma do líquido sugerido do contrato de saldo de comissão por
      profissional, para todos os profissionais do tenant.
- [ ] Profissional com vale acima do que tem a receber contribui com zero e não reduz o que a casa
      deve aos colegas.
- [ ] Profissional inativo ou arquivado com saldo em aberto é incluído.
- [ ] Compromissos sem Data não entram em nenhum agrupamento, no fluxo pendente nem na curva.
- [ ] Cartão de Compromissos sem Data na aba com total e componentes, e link para a aba de Comissões.
- [ ] O cartão avisa que o total pode ser maior que "comissões + gorjetas − vales" quando algum vale
      supera o devido.
- [ ] Resumo ganha o cartão de valor depois dos Compromissos sem Data, ao lado do valor ao fim do
      período.
- [ ] Adaptador Supabase converte os campos novos, com teste de campos ausentes.
- [ ] `CONTEXT.md` ganha o termo Compromissos sem Data.
- [ ] Casos adicionados ao arquivo pgTAP do fluxo de caixa projetado.
- [ ] `npm run test` e `npm run test:db` verdes.
