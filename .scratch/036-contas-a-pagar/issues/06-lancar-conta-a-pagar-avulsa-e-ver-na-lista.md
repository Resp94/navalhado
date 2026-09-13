# 06: Lançar Conta a Pagar avulsa e vê-la na lista paginada

**What to build:** o gestor abre a aba Contas a Pagar do Hub Financeiro, lança uma obrigação com
descrição, Categoria de Despesa, valor e vencimento — e, se quiser, Fornecedor, número do
documento ou da nota e observação — e passa a vê-la na lista antes de pagá-la. Hoje aluguel,
boleto do distribuidor e contador vivem em planilha, caderno ou memória, e o atraso só é
descoberto quando chega a multa.

A lista mostra a situação de cada conta sem que ninguém precise marcá-la: uma conta em aberto com
vencimento anterior ao dia de negócio corrente aparece como **vencida**, e as faixas de destaque
(vencida, vence hoje, vence nos próximos sete dias) ajudam a priorizar. "Hoje" é sempre calculado
no servidor, no fuso horário da barbearia, e nunca vem do aparelho — senão uma conta mudaria de
estado conforme o celular usado. A situação vencida é derivada e nunca armazenada: armazená-la
exigiria um processo agendado, errado entre a virada do dia e a execução, e sem autor humano.

Ao escolher um Fornecedor, a categoria padrão dele preenche a Categoria de Despesa, sem
sobrescrever uma que o gestor já tenha escolhido. A data de competência é gravada já, com o
vencimento como valor inicial, porque o resultado por mês vai precisar dela e não dá para
reconstruí-la depois.

Este ticket abre o livro: tabela, módulo, aba, formulário com a variante avulsa e lista. Baixa,
edição, cancelamento, filtros completos, totais e alerta chegam nos tickets 07 a 09.

**Colunas de Série.** A Conta a Pagar já nasce com as colunas de Série e de posição na Série,
ambas nulas ou ambas preenchidas, sempre nulas neste ticket. A tabela de Série e a **chave
estrangeira** dessas colunas só são criadas no ticket 11.

Spec: `specs/036-contas-a-pagar/spec.md`, seções "Dependência da spec 035", "Entrega 2 — Livro de
Contas a Pagar", "Interface" e "ADR e vocabulário".

**Blocked by:** 035/06 — Cadastro de Fornecedores.

**Status:** ready-for-agent

- [ ] Tabela de Conta a Pagar separada dos movimentos de caixa, com: descrição; Categoria de
      Despesa obrigatória e Fornecedor opcional, ambos por chave estrangeira composta sobre tenant
      e identificador; valor com duas casas e maior que zero; valor baixado entre zero e o valor;
      estado (`open`, `partially_paid`, `paid`, `cancelled`); vencimento; competência; número do
      documento; observação; Série e posição na Série (ambas nulas ou ambas preenchidas, sem chave
      estrangeira até o ticket 11); autor e momento de criação, da última edição e do cancelamento
      com motivo.
- [ ] Restrição amarra estado e valor baixado: `open` sem nada baixado; `partially_paid` com
      valor baixado entre zero e o valor; `paid` com valor baixado igual ao valor; `cancelled` sem
      nada baixado. A trilha de cancelamento é preenchida se e somente se o estado é cancelado.
- [ ] RPC de criação de conta avulsa exige Categoria de Despesa ativa e aceita Fornecedor ativo
      opcional, valida valores arredondados a duas casas com recusa de valor não numérico, grava
      competência igual ao vencimento quando não informada e registra autor e momento (histórias
      6, 7, 10 e 38).
- [ ] Contrato de leitura da lista paginada no servidor: filtro por período de vencimento e estado
      padrão "todas exceto canceladas"; ordenação por vencimento e identificador; tamanho de página
      limitado no servidor; total de linhas na resposta; cada linha traz situação derivada, faixa
      de destaque, saldo restante, nomes de categoria e fornecedor e posição na Série.
- [ ] O dia de negócio corrente é calculado no servidor a partir do fuso do tenant; nenhum
      contrato aceita "hoje" vindo do navegador (histórias 32 e 33).
- [ ] Índices: todo FK indexado na criação (categoria, fornecedor, Série, autores); índice
      composto por tenant e vencimento; índice parcial pelo mesmo par restrito a contas em aberto e
      parcialmente pagas (história 37).
- [ ] Acesso: leitura só para administrador do SaaS ou gerente e proprietário do tenant, com
      contexto de autenticação em subconsulta; nenhuma política nem permissão de escrita direta;
      na tabela, tudo revogado de público, anônimo e autenticado e só leitura concedida ao
      autenticado (sem permissão de truncar); RPCs `security definer` com `search_path` vazio,
      revalidando papel e tenant, execução revogada de público e anônimo e concedida a autenticado
      e serviço. O proprietário recebe o mesmo tratamento das RPCs financeiras existentes.
- [ ] Módulo de Contas a Pagar no padrão existente: interface de adaptador com métodos em
      português; repositório que valida entrada e devolve erro de validação próprio com mensagem
      em português; adaptador Supabase; hook que recebe o repositório por injeção e só instancia o
      padrão quando nada é injetado. Sem adaptador em memória.
- [ ] Aba `/financeiro/contas-a-pagar` montada na estrutura de abas da 035, com barra de filtro de
      período de vencimento própria (no calendário do fuso do tenant, e não o filtro do painel de
      Caixa e Comissões) e lista paginada.
- [ ] A lista usa tabela em telas largas e cartões em largura de celular, no mesmo componente,
      escolhidos por ponto de quebra; a aba é alcançável no celular pela navegação de abas da 035
      (história 36).
- [ ] As contas vencidas, as que vencem hoje e as que vencem nos próximos sete dias aparecem
      destacadas (história 31).
- [ ] Formulário de Conta a Pagar com casca de campos comuns e variante explícita de conta
      avulsa, escolhida por controle segmentado, sem flags booleanas de modo.
- [ ] Ao escolher Fornecedor, a categoria padrão dele preenche a Categoria de Despesa só se
      estiver ativa e só se o gestor ainda não tiver escolhido categoria (história 8).
- [ ] Profissional não vê a aba nem lê a tabela (história 39).
- [ ] Criada a suíte pgTAP `29_contas_a_pagar`, cobrindo:
  - [ ] categoria arquivada recusada no lançamento;
  - [ ] a restrição de estado e valor baixado recusa gravação incoerente, mesmo como superusuário;
  - [ ] situação vencida e faixas de destaque na fronteira do dia de negócio de um tenant com fuso
        diferente de UTC;
  - [ ] paginação estável;
  - [ ] profissional não lê a tabela nem executa a escrita; gerente de outro tenant não lê nem
        escreve.
- [ ] Testes de repositório com adaptador simulado (validação e mensagens) e de adaptador
      simulando o cliente Supabase (mapeamento de parâmetros e resposta), no padrão dos módulos de
      Caixa e Comissões.
- [ ] Teste próprio no nível da aba, com repositório injetado, cobrindo lançamento avulso e a
      lista; componentes internos da aba não ganham arquivo de teste próprio.
- [ ] ADR 020 escrita, registrando: Contas a Pagar como livro separado dos movimentos de caixa;
      Baixa pela gaveta como movimento de caixa vinculado à Baixa; apuração única do valor
      esperado da gaveta com sentido materializado no movimento; movimento de caixa escrito
      exclusivamente por RPC.
- [ ] Glossário do projeto atualizado com Conta a Pagar, Conta a Pagar Vencida e data de
      competência.
- [ ] `npm run test` e `npm run test:db` verdes.
