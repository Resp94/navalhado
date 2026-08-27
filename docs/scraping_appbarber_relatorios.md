# Mapeamento e Engenharia Reversa Estrutural: Módulo de Relatórios e Sub-módulos (AppBarber)

Este documento detalha a engenharia reversa completa da árvore hierárquica do **Módulo de Relatórios e Business Intelligence (BI)** do **AppBarber**, cobrindo os **19 módulos principais** e mais de **145 sub-módulos e visões analíticas internas**.

---

## 1. Estrutura Hierárquica Completa de Módulos e Sub-módulos

A arquitetura de relatórios do AppBarber divide-se em **2 Níveis Hierárquicos**:
- **Nível 1 (Menu Lateral):** Agrupamento por domínio operacional (Agendamentos, Gerencial, Fidelidade, Retenção, Resumo, Aniversariantes).
- **Nível 2 (Sub-módulos Internos / Dropdowns de Tipo):** Seletores reativos internos em cada tela que alteram dinamicamente colunas, métricas, algoritmos de cálculo, filtros e chamadas a endpoints PHP dedicados.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           ÁRVORE HIERÁRQUICA DO MÓDULO DE RELATÓRIOS                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│ 1. Agendamentos                                                                             │
│    ├── 1.1. Geral (#/relatorioagendamento)                                                  │
│    ├── 1.2. Clientes (#/relAgendamentoClientes)                                             │
│    ├── 1.3. Profissionais (#/relatorioprofissionais)                                       │
│    ├── 1.4. Informações & Churn (#/relAgendamentoInformacoes) [8 Sub-módulos]               │
│    ├── 1.5. Recorrentes (#/relAgendamentoRecorrente)                                        │
│    └── 1.6. Assinaturas (#/relAgendamentosAssinaturas) [3 Sub-módulos]                       │
│                                                                                             │
│ 2. Gerencial (BI & Analytics)                                                               │
│    ├── 2.1. Agendamentos (#/relatoriogerencialagendamentos) [8 Sub-módulos]                  │
│    ├── 2.2. Perfil Cliente (#/relatoriogerencialperfil) [7 Sub-módulos Demográficos]        │
│    ├── 2.3. Financeiro (#/relatoriogerencialfinanceiro) [42 Sub-módulos Financeiros / DRE]  │
│    ├── 2.4. Comandas Canceladas (#/relGerencialComandas)                                    │
│    ├── 2.5. Comandas Itens (#/relGerencialComandasItens) [2 Sub-módulos]                     │
│    ├── 2.6. Estoque & Curva ABC (#/relGerencialEstoque) [10 Sub-módulos de Estoque]         │
│    ├── 2.7. Pacotes (#/relGerencialPacotes) [4 Sub-módulos de Pacotes]                       │
│    ├── 2.8. Rankings (#/relGerencialRankings) [33 Modalidades de Rankings]                  │
│    └── 2.9. Assinaturas & Clubes (#/relGerencialAssinaturas) [13 Sub-módulos de Assinaturas]│
│                                                                                             │
│ 3. Programa de Fidelidade (#/relatoriofidelidade) [4 Sub-módulos de Pontos]                 │
│ 4. Clientes / Retorno & Retenção (#/relatorioclientes) [9 Sub-módulos de Retenção]          │
│ 5. Resumo Executivo 360º (#/relatorioresumo) [5 Abas & 4 Sub-dashboards]                    │
│ 6. Aniversariantes (#/relAniversariantes)                                                   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Catálogo Exaustivo dos Sub-módulos Internos

Abaixo estão detalhados todos os sub-módulos mapeados por tela:

---

### 2.1. Módulo: `Agendamentos > Informações & Churn` (`#/relAgendamentoInformacoes`)
- **Controller:** `relDiasSemVirCtrl.js` (51 KB)
- **Sub-módulos Internos (Seletor `tipo`):**
  1. `Dias Sem Vir (Com cada profissional)`: Lista clientes sem atendimento com um barbeiro específico.
  2. `Dias Sem Vir (Último Agendamento Geral)`: Lista clientes inativos no estabelecimento (30, 60, 90+ dias).
  3. `Clientes Sem Agendamento`: Clientes cadastrados que nunca agendaram.
  4. `Clientes Com Apenas 1 Agendamento no Período`: Clientes que vieram uma única vez (oportunidade de 2ª visita).
  5. `Agendamentos por Plataforma`: Volume por canal (App iOS, App Android, Web Online, Totem, Painel).
  6. `Assiduidade`: Média de dias de intervalo entre visitas de cada cliente.
  7. `Primeiro Agendamento`: Relatório de novos clientes convertidos.
  8. `Agendamentos feitos via sem preferência`: Clientes agendados sem escolher profissional específico (roleta/rodízio).
- **Endpoints Associados:**
  - `POST /pages/relatorios/buscaRelDiasSemVir.php`
  - `POST /pages/relatorios/buscaRelatorioAssiduidade.php`
  - `POST /pages/relatorios/buscaRelatorioAgendamentoDispositivo.php`
  - `POST /pages/relatorios/buscaRelatorioAdministradorUltimoAgendamentov2.php`

---

### 2.2. Módulo: `Agendamentos > Assinaturas` (`#/relAgendamentosAssinaturas`)
- **Controller:** `relAgendamentosAssinaturasCtrl.js`
- **Sub-módulos Internos (Seletor `tipoRelatorio`):**
  1. `Frequência de Assinantes`: Quantidade média de idas por semana/mês de cada membro do clube.
  2. `Quantidade de assinantes atendidos por dia da semana`: Dias de maior impacto dos planos recorrentes.
  3. `Quantidade de assinantes atendidos por data`: Consumo diário de cortes/barbas contratados.
- **Endpoint Principal:** `POST /pages/relatorios/buscaRelatorioAgendamentosAssinaturas.php`

---

### 2.3. Módulo: `Gerencial > Agendamentos (BI)` (`#/relatoriogerencialagendamentos`)
- **Controller:** `relGerencialAgendamentosCtrl.js`
- **Sub-módulos Internos (Seletor `selTipo`):**
  1. `Quantidade de Agendamentos por Horário no Período`: Identificação de picos e ociosidade na grade horária.
  2. `Quantidade de Agendamentos por Dia da Semana no Período`: Comparativo de volume (Terça a Domingo).
  3. `Quantidade de Agendamentos por Dia do Mês no Período`: Curva diária de demanda.
  4. `Quantidade de Agendamentos por Mês no Período`: Sazonalidade mensal.
  5. `Quantidade de Agendamentos por Plataforma no Período`: Proporção de auto-agendamento via App.
  6. `Quantidade de Agendamentos por Status no Período`: Comparecimento vs Cancelamentos vs No-Show.
  7. `Quantidade de Agendamentos Cadastrados por Turno`: Manhã, Tarde e Noite.
  8. `Quantidade de Agendamentos Cadastrados por Dia da Semana`: Dia em que os clientes mais costumam marcar.
- **Endpoint Principal:** `POST /pages/relatorios/buscaRelGerencial.php`

---

### 2.4. Módulo: `Gerencial > Perfil Cliente (Demografia)` (`#/relatoriogerencialperfil`)
- **Controller:** `relGerencialPerfilCtrl.js`
- **Sub-módulos Internos (Seletor `selTipo`):**
  1. `Clientes por Sexo`: Distribuição de gênero.
  2. `Clientes por Faixa Etária`: Pirâmide etária da base.
  3. `Clientes por Cidade`: Abrangência geográfica.
  4. `Clientes por Estado`: Origem por UF.
  5. `Clientes por Região`: Macrozonas.
  6. `Clientes por Bairro`: Densidade de clientes em bairros vizinhos.
  7. `Clientes cadastrados por Mês`: Curva de crescimento da base.
- **Endpoint Principal:** `POST /pages/relatorios/buscaRelGerencialCliente.php`

---

### 2.5. Módulo: `Gerencial > Financeiro & DRE` (`#/relatoriogerencialfinanceiro`)
- **Controller:** `relGerenciamentoFinanceiroCtrl.js` (171 KB)
- **Sub-módulos Internos (Seletor `Tipo` - 42 Visões Especializadas):**
  1. `Dashboard Geral`: DRE sintético, faturamento bruto, custos de comissão e lucro operacional.
  2. `Entrada e Saída Mês`: Balancete comparativo de movimentações financeiras.
  3. `Gráfico de Saldo Mensal`: Curva evolutiva de liquidez.
  4. `Dashboard Profissional`: Faturamento e ticket gerado por cada profissional.
  5. `Total de Recebimentos no Período`: Faturamento consolidado.
  6. `Total de Receitas por Tipo`: Receita por categoria cadastrada.
  7. `Analítico Receitas`: Detalhamento linha a linha de cada recebimento.
  8. `Recebimentos Provisionados`: Contas a receber futuras.
  9. `Reposições`: Reposições de caixa provenientes de sangria.
  10. `Total de Despesas no Período`: Custos totais consolidados.
  11. `Total de Despesas por Tipo`: Despesas fixas vs variáveis por conta.
  12. `Total de Despesas Não Baixadas por Tipo`: Contas a pagar em aberto / provisionadas.
  13. `Total de Despesas por Categoria`: Agrupamento gerencial de custos.
  14. `Analítico Despesas`: Extrato minucioso de saídas.
  15. `Sangrias de Caixa`: Retiradas pontuais efetuadas nos caixas do dia.
  16. `Retiradas de Financeiro`: Retiradas de pró-labore/lucro de sócios (expurgadas da DRE).
  17. `Movimentações de Cartão no Período`: Vendas por meio eletrônico.
  18. `Total de Pagamentos de Cartão`: Crédito vs Débito vs Parcelado.
  19. `Total de Pagamentos de Cartão por Bandeira`: Visa, Master, Elo, Hiper, Amex.
  20. `Recebimento Total por Tipo de Pagamento`: Dinheiro, Cartão, PIX, Boleto.
  21. `Analítico Tipo de Pagamento`: Linha a linha com códigos de autorização/NSU.
  22. `Total de Saídas por Tipo de Pagamento`: Meios usados para pagar contas da barbearia.
  23. `Comandas/Pacotes que não foram para o caixa`: Auditoria de vendas finalizadas sem gerar caixa.
  24. `Cortesias`: Serviços e produtos concedidos com 100% de desconto.
  25. `Comandas com valor total e valor pago diferentes`: Auditoria de divergências no checkout.
  26. `Comandas com diferença não lançada na conta do cliente`: Divergências que não viraram fiado.
  27. `Relatório de descontos`: Descontos nominais e percentuais aplicados pela gerência.
  28. `Comandas em Caixas com Datas Diferentes`: Comandas retroativas ou abertas fora de hora.
  29. `Relação de Comandas dos Caixas`: Cruzamento de comandas vinculadas a cada caixa fechado.
  30. `Relatório de uso de cupons de desconto`: Eficácia e volume de vouchers promocionais.
  31. `Ranking Serviços`: Faturamento agrupado por serviço prestado.
  32. `Lucro por Serviços`: Margem de lucro de cada serviço após abater comissões e insumos.
  33. `Ranking Produtos`: Faturamento agrupado por produto de revenda.
  34. `Lucro por Produtos`: Margem bruta e líquida de revenda.
  35. `Movimentações de Serviços por Tipo de Pagamento`: Como os clientes pagam os serviços.
  36. `Movimentações de Produtos por Tipo de Pagamento`: Como os clientes pagam os produtos.
  37. `Relatório Detalhado de Movimentações`: Extrato completo contábil.
  38. `Saldo Movimentado por Fornecedor por Mês`: Gastos agrupados por parceiro/fornecedor.
  39. `Movimentações por Fornecedor`: Extrato analítico de compras.
  40. `Relatório com número de nota fiscal informado`: Conferência fiscal e SPED.
  41. `Demonstrativo Anual`: Fechamento contábil de 12 meses.
  42. `Vendas de Profissional`: Total vendido por profissional em balcão.

- **Endpoints do Gerencial Financeiro:**
  - `POST /pages/relatorios/buscarelGerencialFinanceirov2.php`
  - `POST /pages/relatorios/buscaGraficoRelGerencialFinanceirov2.php`
  - `POST /pages/relatorios/buscaRelGerencialDRE.php`
  - `POST /pages/relatorios/buscaComissoesProfissionaisTotaisv2.php`
  - `POST /pages/relatorios/buscaRelGerencialVendaItens.php`
  - `POST /pages/relatorios/buscaRelatorioComandaCaixa.php`

---

### 2.6. Módulo: `Gerencial > Estoque & Curva ABC` (`#/relGerencialEstoque`)
- **Controller:** `relGerencialEstoqueCtrl.js` (36 KB)
- **Sub-módulos Internos (Seletor `estTipo`):**
  1. `Relação Saldo do Estoque e Quantidade Mínima`: Alerta de ponto de pedido e ruptura de estoque.
  2. `Movimentações por Período`: Entradas, saídas e transferências de produtos.
  3. `Relatórios de Ajuste de Estoque`: Auditoria de correções manuais e perdas.
  4. `Relatório Lucro por Produto`: Margem sobre CMV (Custo de Mercadoria Vendida).
  5. `Relatório Cortesias`: Baixas de estoque por cortesia.
  6. `Relatório Produtos "Para Uso"`: Consumo interno de insumos na bancada dos barbeiros.
  7. `Relatório de Validade de Produtos`: Lotes próximos ao vencimento.
  8. `Relatório de Inventário do Estoque`: Posição patrimonial total em estoque.
  9. `Produtos em Comandas Abertas`: Itens lançados na bancada aguardando checkout.
  10. `Histórico de Estoque`: Rastreabilidade completa por SKU.
- **Endpoint Principal:** `POST /pages/relatorios/buscaRelGerencialEstoque.php`

---

### 2.7. Módulo: `Gerencial > Pacotes` (`#/relGerencialPacotes`)
- **Controller:** `relGerencialPacotesCtrl.js`
- **Sub-módulos Internos (Seletor `pacTipo`):**
  1. `Venda de Pacotes`: Volume comercializado de combos/pacotes.
  2. `Pacotes Expirados`: Pacotes com prazo de validade vencido sem consumo total.
  3. `Pacotes em Aberto`: Saldo de sessões pendentes a executar (passivo operacional).
  4. `Relação de Serviços em vendas de pacotes`: Detalhamento dos serviços embutidos.
- **Endpoint Principal:** `POST /pages/relatorios/buscaRelGerencialPacotes.php`

---

### 2.8. Módulo: `Gerencial > Rankings` (`#/relGerencialRankings`)
- **Controller:** `relGerencialRankingsCtrl.js` (82 KB)
- **Sub-módulos Internos (Seletor `ranTipo` - 33 Modalidades de Ranking):**
  1. `Serviços × Quantidade`
  2. `Serviços × Valor Total`
  3. `Categoria de Serviços × Quantidade`
  4. `Categoria de Serviços × Valor`
  5. `Produtos × Quantidade`
  6. `Produtos × Valor Total`
  7. `Categoria de Produtos × Quantidade`
  8. `Categoria de Produtos × Valor`
  9. `Valor Médio por Categoria de Produto`
  10. `Cliente × Serviços (Quantidade)`
  11. `Cliente × Serviços (Valor)`
  12. `Cliente × Produtos (Quantidade)`
  13. `Cliente × Produtos (Valor)`
  14. `Cliente × Valor Total Gasto (LTV)`
  15. `Cliente × Quantidade de Agendamentos`
  16. `Profissional × Serviços (Quantidade)`
  17. `Profissional × Serviços (Valor)`
  18. `Profissional × Categoria de Serviços (Quantidade)`
  19. `Profissional × Categoria de Serviços (Valor)`
  20. `Profissional × Produtos (Quantidade)`
  21. `Profissional × Produtos (Valor)`
  22. `Profissional × Indicações Recebidas`
  23. `Profissional × Quantidade de Serviço Executada`
  24. `Profissional × Valor de Serviço Executado`
  25. `Profissional × Quantidade de Produtos Vendidos`
  26. `Profissional × Valor de Produtos Vendidos`
  27. `Profissional × Total de Clientes Atendidos`
  28. `Tempo Médio em Atendimento`
  29. `Ticket Médio de Comandas`
  30. `Ticket Médio por Profissional`
  31. `Ticket Médio por Cliente`
  32. `Ticket Médio por Assinatura`
- **Endpoint Principal:** `POST /pages/relatorios/buscaRelGerencialRankingv5.php`

---

### 2.9. Módulo: `Gerencial > Assinaturas & Clubes` (`#/relGerencialAssinaturas`)
- **Controller:** `relGerencialAssinaturaCtrl.js` (72 KB)
- **Sub-módulos Internos (Seletor `tipoRelAssinatura` - 13 Visões):**
  1. `Agendamentos por Assinatura`: Volume de serviços agendados por assinantes.
  2. `Média de Rendimento por Clube`: Rentabilidade por plano recorrente.
  3. `Quantidade de Atendimentos por Cliente em Clubes de Assinatura`: Quem mais consome o plano.
  4. `Quantidade de Serviços Realizados por Assinatura`: Mix de cortes, barbas, sobrancelhas etc.
  5. `Atendimentos por Profissional por Assinatura`: Volume absorvido por cada colaborador.
  6. `Quantidade Utilizada por Cliente por Fatura`: Controle de limite contratual por ciclo.
  7. `Faturas Pagas no Período por Cliente`: Extrato de cobrança recorrente.
  8. `Faturas Pagas no Período por Assinatura`: Receita agregada por plano (MRR).
  9. `Agendamentos de Comissões de Assinaturas já geradas`: Repasse apurado para a equipe.
  10. `Detalhamento de Comissões`: Linha a linha com data e percentual do repasse de assinaturas.
  11. `Cancelamento de Assinaturas`: Motivos de cancelamento e taxa de Churn.
  12. `Quantidade de Assinantes por Plano`: Base ativa de membros.
  13. `Novas Contratações no Período (Plano Comum)`: Vendas de novas assinaturas.
- **Endpoint Principal:** `POST /pages/relatorios/buscaRelGerencialAssinatura.php`

---

### 2.10. Módulo: `Programa de Fidelidade` (`#/relatoriofidelidade`)
- **Controller:** `relFidelidadeCtrl.js`
- **Sub-módulos Internos (Seletor `selTipo`):**
  1. `Pontos`: Saldo acumulado atual por cliente.
  2. `Movimentações`: Extrato completo de créditos e débitos de pontos.
  3. `Lista de itens para Resgate`: Produtos e serviços disponíveis para troca por pontos.
  4. `Tokens Utilizados`: Cupons/vouchers de pontos validados em comandas.
- **Endpoints:**
  - `POST /pages/relatorios/buscaProgramaFidelidade.php`
  - `POST /pages/relatorios/buscaListaPontosItens.php`

---

### 2.11. Módulo: `Clientes / Retenção & Retorno` (`#/relatorioclientes`)
- **Controller:** `relRetornoCtrl.js` (56 KB)
- **Sub-módulos Internos (Seletor `tipoRel`):**
  1. `Mensagens de Retorno`: Clientes impactados por réguas automáticas de mensagem.
  2. `Cadastrados no período`: Novos clientes inseridos na base.
  3. `Acessos dos clientes`: Clientes que já fizeram login no aplicativo móvel.
  4. `Clientes sem Acesso`: Clientes cadastrados que nunca baixaram/acessaram o app.
  5. `Sorteio`: Módulo para sorteio automatizado entre clientes atendidos no período.
  6. `Clientes Únicos atendidos no período`: Audiência líquida sem repetições.
  7. `Retorno por período`: Taxa de retorno de 1ª para 2ª e 3ª visitas.
  8. `Como soube`: Pesquisa de canais de aquisição (Google, Instagram, Indicação, Fachada).
  9. `Atendimentos no período`: Relação nominal de atendimentos.
- **Endpoints:**
  - `POST /pages/relatorios/buscaRetornoClientes.php`
  - `POST /pages/relatorios/buscaNovosClientesCadastrados.php`
  - `POST /pages/relatorios/RELATORIO_Atendimentos.php`
  - `POST /pages/relatorios/buscaRelatorioRetornoMensagem.php`

---

### 2.12. Módulo: `Resumo Executivo 360º` (`#/relatorioresumo`)
- **Controller:** `relResumoCtrl.js` (45 KB)
- **Abas Principais:**
  1. **Aba `Resumo`:** 12 cards de gargalos operacionais:
     - Comandas Pendentes / Abertas
     - Clientes com Crédito em Conta
     - Clientes em Débito em Conta ("Fiado")
     - Caixas Pendentes de Fechamento
     - Clientes sem Usuário de App
     - Retorno de Clientes
     - Contas a Receber na Semana
     - Contas a Pagar na Semana
     - Clientes sem comparecer há mais de 60 dias
     - Usuários que conectaram ao menos uma vez
     - Novos clientes na última semana
     - Produtos a vencer em 30 dias
     - Contas a pagar atrasadas
     - Assinaturas a vencer ou vencidas
  2. **Aba `Dashboard`:** Faturamento diário, semanal e mensal em tempo real.
  3. **Aba `Comparativos`:** Comparativo mês atual vs mês anterior por Serviço, Profissional e Produto (`buscaRelGerencialComparativo.php`).
  4. **Aba `Vendas`:** Mix de faturamento (Serviços vs Produtos).
  5. **Aba `Profissionais`:** 4 Sub-visões de equipe:
     - `Mapa de Calor`: Ocupação por dia e hora.
     - `Taxa de Ocupação por Profissional`: % de tempo em atendimento vs ocioso.
     - `Média de Ocupação do Estabelecimento`.
     - `Taxa de Fidelização do Estabelecimento` (`RELATORIO_Taxa_Fidelizacao.php`).
- **Endpoints:**
  - `POST /pages/relatorios/buscaRelDashboard.php`
  - `POST /pages/relatorios/buscaRelGerencialComparativo.php`
  - `POST /pages/relatorios/RELATORIO_Taxa_Fidelizacao.php`
  - `POST /pages/relatorios/buscaRelGerencialDashboardProfissional.php`
