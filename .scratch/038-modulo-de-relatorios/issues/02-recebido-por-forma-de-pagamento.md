# 02: Recebido por forma de pagamento

**What to build:** na página Faturamento, o gestor vê quanto foi recebido em PIX, dinheiro, cartão
de crédito, cartão de débito e outros no período, em valor, percentual e quantidade de pagamentos, e
como isso se distribuiu ao longo dos agrupamentos. Assim ele confere o que caiu na conta e o que
ficou na gaveta, e percebe mudança de hábito dos clientes.

O recebido conta pela data do pagamento (e não pelo fechamento da Comanda), com o mesmo predicado de
"recebido" do resumo financeiro diário e do Fluxo de Caixa Projetado. A tabela viva de pagamentos já
está líquida de estornos: não se subtrai o arquivo de estornos. A página sempre diz "recebido" para
esta seção e "faturamento" para a seção do ticket 01.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seção "1–3. `get_revenue_report`" (recebido) e
histórias 22 a 27.

**Blocked by:** 01 — Esqueleto do módulo e Faturamento por período.

**Status:** done

- [x] O contrato de Faturamento passa a devolver o recebido total, o recebido por forma de pagamento
      no período (valor, quantidade de pagamentos e participação) e, em cada agrupamento, o recebido
      e a quantidade de pagamentos por forma.
- [x] Pagamentos contam pelo dia de negócio do pagamento no fuso do tenant; pagamento às 23h30 local
      cai no dia local.
- [x] O recebido é agregado na própria CTE, separado da CTE de faturamento, antes de juntar por
      agrupamento: as duas fontes têm várias linhas por agrupamento e, juntas num mesmo `group by`,
      multiplicariam os totais. Um teste com dois dias de faturamento e dois pagamentos no mesmo
      agrupamento trava essa regra.
- [x] Filtro de pagamentos como intervalo meio aberto sobre a coluna de pagamento, usando o índice
      por tenant e momento do pagamento que já existe.
- [x] Comanda reaberta some do recebido, sem subtrair o arquivo de estornos.
- [x] Teste cruzado: o recebido de um dia é igual ao recebido de `get_daily_financial_summary` no
      mesmo dia.
- [x] Formas exibidas com rótulos PIX, Dinheiro, Crédito, Débito e Outros; forma sem pagamento no
      período aparece com zero.
- [x] Participação com período sem recebimento devolve vazio, nunca divisão por zero.
- [x] Adaptador converte os campos novos; teste do adaptador cobre campos ausentes.
- [x] Página Faturamento ganha seção "Recebido por forma de pagamento" com barras horizontais de
      participação e tabela equivalente; a distinção entre formas não depende só de cor.
- [x] Casos novos no pgTAP `33_relatorio_faturamento` (plano ajustado) e caso novo no teste da página.
- [x] `npm run test` e pgTAP verdes.
