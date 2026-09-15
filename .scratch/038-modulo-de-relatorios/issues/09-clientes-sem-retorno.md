# 09: Clientes sem Retorno

**What to build:** o gestor abre a página Clientes sem Retorno e vê a lista de clientes cuja última
Visita passou do Tempo de Retorno do serviço realizado e que não têm Agendamento futuro marcado,
ordenada pelos mais atrasados, com data da última Visita, serviço, prazo, dias passados e dias de
atraso. Pode filtrar por faixa de atraso e por profissional, abrir a Central 360º do cliente e
iniciar a conversa no WhatsApp. Assim o relatório vira ação de reativação.

Este ticket cria a segunda regra compartilhada da spec, a **Visita**: um cliente identificado esteve
na barbearia num dia de negócio, por Agendamento concluído ou por Comanda fechada com cliente; os
dois no mesmo dia são uma Visita só. Visita de balcão (Comanda sem Agendamento) conta, para que o
cliente que veio sem marcar não apareça como sumido. O relatório não tem período: é uma fotografia de
hoje, e não dispara mensagem.

Spec: `specs/038-modulo-de-relatorios/spec.md`, seções "Regras de domínio compartilhadas" (Visita) e
"8. `get_customers_without_return`", e histórias 56 a 64.

**Blocked by:** 01 — Esqueleto do módulo e Faturamento por período; 04 — Gráfico de evolução e
exportação CSV.

**Status:** ready-for-agent

- [ ] Função privada de Visita em `language sql`, `STABLE`, retornando conjunto e sem concessão para
      autenticado nem anônimo (mesmo padrão da função de Receita Reconhecida do ticket 01), para que
      o planejador consiga embutir a consulta e empurrar os filtros de tenant e data. Recebe tenant e
      devolve, por cliente e dia de negócio, os serviços
      realizados (dos itens de serviço da Comanda, ou do serviço do Agendamento sem Comanda) e o
      profissional (do Agendamento, ou do item de serviço de maior valor da Comanda).
- [ ] Contrato de leitura recebe tenant, faixa de atraso opcional, profissional opcional, limite
      (máximo 100) e deslocamento, e devolve fuso, dia de negócio de hoje, totais (sem retorno, dentro
      do prazo, sem nenhuma Visita), contagem por faixa, total de linhas e os itens da página.
- [ ] Mesmo padrão de função pública, núcleo privado com relógio injetado e acesso do ticket 01;
      validação de limite, deslocamento e faixa com mensagens em pt-BR.
- [ ] Prazo = menor Tempo de Retorno entre os serviços da última Visita; sem serviço ou sem prazo, 20
      dias, como o lembrete de retorno existente.
- [ ] Cliente sem Retorno = dias desde a última Visita maior que o prazo e nenhum Agendamento
      pendente ou confirmado depois de agora.
- [ ] Faixas de atraso: até 15, 16 a 30, 31 a 60, mais de 60 dias.
- [ ] Totais e faixas ignoram paginação e filtro de faixa, mas respeitam o filtro de profissional.
- [ ] Índice de Agendamentos por tenant, cliente e início criado se ausente (hoje só existe índice por
      cliente isolado), com "se não existir" e sem `concurrently`.
- [ ] Retorno em `jsonb`, com totais e faixas fora da lista: eles precisam chegar mesmo quando a
      página vem vazia, o que uma leitura em linhas (como a de Contas a Pagar) não garante.
      `total_count` é contado sobre o conjunto filtrado, antes da paginação.
- [ ] `explain (analyze, buffers)` da consulta com a base do dev registrado nas notas do ticket,
      confirmando uso do índice novo.
- [ ] Arquivo pgTAP `37_relatorio_clientes_sem_retorno` cobrindo acesso, prazo pelo menor serviço e
      padrão 20, Agendamento futuro confirmado (fora) e cancelado (dentro), Visita de balcão como
      última Visita, Agendamento concluído e Comanda no mesmo dia como uma Visita, fronteiras 15/16,
      30/31 e 60/61, e paginação sem alterar totais.
- [ ] Repositório, adaptador e hook da página, com testes de validação de paginação e conversão.
- [ ] Rota `/relatorios/clientes-sem-retorno`, que esconde o filtro de período do layout e mostra os
      próprios filtros; catálogo passa a linkar o relatório.
- [ ] Página com cartões de totais e faixas, tabela paginada, ação de abrir a Central 360º, ação de
      WhatsApp (sem texto pré-preenchido) indisponível para cliente sem telefone, estados vazio,
      carregando e erro e "Exportar CSV" da página atual, só em layout desktop.
- [ ] Teste da página com repositório falso cobrindo paginação e WhatsApp indisponível sem telefone.
- [ ] `CONTEXT.md` ganha Visita e Cliente sem Retorno.
- [ ] `npm run test` e pgTAP verdes.
