# 11: Origem dos clientes

**What to build:** na página Clientes, o gestor vê quantos clientes foram cadastrados no período,
separados pela origem do cadastro (balcão, agenda, link público, Canal do Cliente, WhatsApp,
importação) e pelo canal de aquisição declarado (Instagram, indicação, Google e outros), e quantos
de cada grupo já tiveram ao menos uma Visita. Assim ele sabe por onde a base entra e qual canal traz
cliente que aparece, e não só cadastro.

Origem do cadastro (automática, sempre preenchida) e canal de aquisição (declarado, opcional)
aparecem separados, porque respondem perguntas diferentes. No banco dev todos os clientes estão com
canal vazio, consequência do Perfil Progressivo do Cliente: por isso "Não informado" é sempre
mostrado, com o percentual preenchido em destaque.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seção "9–10. `get_customer_report`" (cadastros),
Further Notes "Dado ralo no canal de aquisição" e histórias 71 a 75.

**Blocked by:** 10 — Novos x recorrentes.

**Status:** done

- [x] O contrato de Clientes passa a devolver cadastros do período: total, provisórios (cadastro
      incompleto), por origem do cadastro e por canal de aquisição (cada grupo com total e com Visita)
      e percentual de canal preenchido.
- [x] Base de cadastros: clientes com criação no período, no fuso do tenant.
- [x] Canal de aquisição agrupado por texto normalizado (sem espaços nas pontas, sem diferença de
      maiúsculas), exibido com a grafia mais frequente; nulo ou vazio como "Não informado".
- [x] Com Visita = clientes do grupo com ao menos uma Visita até hoje, pela regra de Visita do ticket
      09.
- [x] Período sem cadastro devolve percentual preenchido vazio, nunca divisão por zero.
- [x] Índice de clientes por tenant e criação criado se ausente, com "se não existir" e sem
      `concurrently`; filtro como intervalo meio aberto sobre a coluna de criação, sem envolvê-la em
      função.
- [x] Distribuição por origem do cadastro e por canal de aquisição agregadas cada uma na própria CTE,
      e o cruzamento com "já teve Visita" resolvido por existência, não por junção que duplique
      cliente com várias Visitas.
- [x] Casos novos no pgTAP `36_relatorio_clientes` (plano ajustado): grafias diferentes agrupadas,
      nulo em "Não informado", percentual preenchido, com Visita.
- [x] Adaptador converte os campos novos; teste atualizado.
- [x] Página Clientes ganha seção "Origem dos clientes" com as duas distribuições lado a lado (barras
      horizontais e tabela), destaque de "Não informado" com o percentual preenchido e texto
      orientando a completar o canal na Central 360º, e "Exportar CSV".
- [x] Caso novo no teste da página cobrindo o destaque de "Não informado".
- [x] `CONTEXT.md` ganha Origem do Cadastro e Canal de Aquisição.
- [x] `npm run test` e pgTAP verdes.
