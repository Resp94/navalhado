# 03: Entradas estimadas por dia da semana

**What to build:** o gestor passa a ver quanto deve entrar em cada dia futuro, com base no que a
barbearia costuma receber naquele dia da semana. Hoje ele sabe que sábado é forte e segunda é fraca,
mas faz a conta de cabeça.

A Entrada Estimada de um dia futuro é a média do recebido nas N ocorrências mais recentes do mesmo
dia da semana, com N limitado a 8. A janela são os N × 7 dias de negócio imediatamente anteriores a
hoje, o que dá a cada dia da semana exatamente N amostras em dias inteiros, sem escolher em que dia a
semana começa. Dias sem recebimento na janela entram como zero. N vem do histórico real, contado a
partir do primeiro dia com pagamento de Comanda vivo, para que o intervalo entre o cadastro e o
primeiro atendimento não vire semanas de zero. Com menos de 4 semanas não há estimativa: um único
dia atípico dominaria a média.

Dias em que a barbearia está fechada pelo horário de funcionamento configurado valem zero, mesmo com
histórico. Dia ausente na configuração é lido como fechado, como a agenda já faz. Hoje não recebe
estimativa: somar a média do dia inteiro ao que já entrou de manhã duplicaria receita, e a projeção
fica deliberadamente conservadora. Feriados, sazonalidade e tendência ficam fora. A estimativa é
calculada a cada consulta e nunca gravada.

A estimativa aparece sempre rotulada e visualmente distinta do realizado, como variante explícita, e
a tela lembra que ela não desconta as comissões que essa receita vai gerar.

**Cadeia sequencial:** este ticket redefine a mesma função de leitura do fluxo que os tickets 01, 02,
05, 07 e 08. Não pode correr em paralelo com outro ticket da cadeia.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seção "Entradas estimadas: média por dia da
semana".

**Blocked by:** 02 (Quitações de Comissão e vales como saída realizada).

**Status:** ready-for-agent

- [ ] Contrato devolve o estado da estimativa (ok ou histórico insuficiente), o número de semanas
      usadas e as sete médias por dia da semana, para que a tela rotule sem recalcular.
- [ ] Média com 8 semanas: soma do recebido do dia da semana na janela dividida por 8, arredondada a
      duas casas.
- [ ] Média com N entre 4 e 7 usa N semanas e devolve o número de semanas usadas correto.
- [ ] Com N abaixo de 4 o estado é histórico insuficiente e as entradas estimadas futuras ficam
      vazias, e não zeradas.
- [ ] N é contado a partir do primeiro dia de negócio com pagamento de Comanda vivo no tenant, e não
      da criação do tenant.
- [ ] Dias sem recebimento dentro da janela contam como zero na média.
- [ ] Dia marcado como inativo, ou ausente, no horário de funcionamento do tenant tem estimativa zero.
- [ ] Hoje fica fora da janela e não recebe estimativa; a estimativa começa amanhã.
- [ ] Agrupamentos somam a entrada estimada dos seus dias futuros, e o detalhamento devolve dias
      estimados e dias fechados.
- [ ] Entradas estimadas entram no fluxo pendente do agrupamento.
- [ ] Um período inteiramente passado não devolve estimativa.
- [ ] Na aba, todo número estimado leva o rótulo textual "estimado" e é uma variante explícita de
      exibição, não um atributo booleano espalhado; a distinção nunca depende só de cor.
- [ ] Cartão de entradas estimadas no resumo e coluna estimada na tabela e nos cartões de celular.
- [ ] Avisos: "histórico insuficiente para estimar entradas" ou "estimativa baseada em N semanas";
      "a estimativa de entradas não desconta comissões que essa receita vai gerar"; "hoje mostra
      apenas o realizado".
- [ ] Teste da aba com repositório falso injetado cobre o rótulo de estimativa visível e o aviso de
      histórico insuficiente.
- [ ] Adaptador Supabase converte o objeto de estimativa e os campos novos.
- [ ] `CONTEXT.md` ganha o termo Entrada Estimada.
- [ ] Casos de estimativa adicionados ao arquivo pgTAP do fluxo de caixa projetado, usando o núcleo
      com relógio injetado.
- [ ] `npm run test` e `npm run test:db` verdes.
