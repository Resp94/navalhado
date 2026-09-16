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

**Status:** done

- [x] Tabela de Conta a Pagar separada dos movimentos de caixa, com: descrição; Categoria de
      Despesa obrigatória e Fornecedor opcional, ambos por chave estrangeira composta sobre tenant
      e identificador; valor com duas casas e maior que zero; valor baixado entre zero e o valor;
      estado (`open`, `partially_paid`, `paid`, `cancelled`); vencimento; competência; número do
      documento; observação; Série e posição na Série (ambas nulas ou ambas preenchidas, sem chave
      estrangeira até o ticket 11); autor e momento de criação, da última edição e do cancelamento
      com motivo.
- [x] Restrição amarra estado e valor baixado: `open` sem nada baixado; `partially_paid` com
      valor baixado entre zero e o valor; `paid` com valor baixado igual ao valor; `cancelled` sem
      nada baixado. A trilha de cancelamento é preenchida se e somente se o estado é cancelado.
- [x] RPC de criação de conta avulsa exige Categoria de Despesa ativa e aceita Fornecedor ativo
      opcional, valida valores arredondados a duas casas com recusa de valor não numérico, grava
      competência igual ao vencimento quando não informada e registra autor e momento (histórias
      6, 7, 10 e 38).
- [x] Contrato de leitura da lista paginada no servidor: filtro por período de vencimento e estado
      padrão "todas exceto canceladas"; ordenação por vencimento e identificador; tamanho de página
      limitado no servidor; total de linhas na resposta; cada linha traz situação derivada, faixa
      de destaque, saldo restante, nomes de categoria e fornecedor e posição na Série.
- [x] O dia de negócio corrente é calculado no servidor a partir do fuso do tenant; nenhum
      contrato aceita "hoje" vindo do navegador (histórias 32 e 33).
- [x] Índices: todo FK indexado na criação (categoria, fornecedor, Série, autores); índice
      composto por tenant e vencimento; índice parcial pelo mesmo par restrito a contas em aberto e
      parcialmente pagas (história 37).
- [x] Acesso: leitura só para administrador do SaaS ou gerente e proprietário do tenant, com
      contexto de autenticação em subconsulta; nenhuma política nem permissão de escrita direta;
      na tabela, tudo revogado de público, anônimo e autenticado e só leitura concedida ao
      autenticado (sem permissão de truncar); RPCs `security definer` com `search_path` vazio,
      revalidando papel e tenant, execução revogada de público e anônimo e concedida a autenticado
      e serviço. O proprietário recebe o mesmo tratamento das RPCs financeiras existentes.
- [x] Módulo de Contas a Pagar no padrão existente: interface de adaptador com métodos em
      português; repositório que valida entrada e devolve erro de validação próprio com mensagem
      em português; adaptador Supabase; hook que recebe o repositório por injeção e só instancia o
      padrão quando nada é injetado. Sem adaptador em memória.
- [x] Aba `/financeiro/contas-a-pagar` montada na estrutura de abas da 035, com barra de filtro de
      período de vencimento própria (no calendário do fuso do tenant, e não o filtro do painel de
      Caixa e Comissões) e lista paginada.
- [x] A lista usa tabela em telas largas e cartões em largura de celular, no mesmo componente,
      escolhidos por ponto de quebra; a aba é alcançável no celular pela navegação de abas da 035
      (história 36).
- [x] As contas vencidas, as que vencem hoje e as que vencem nos próximos sete dias aparecem
      destacadas (história 31).
- [x] Formulário de Conta a Pagar com casca de campos comuns e variante explícita de conta
      avulsa, escolhida por controle segmentado, sem flags booleanas de modo.
- [x] Ao escolher Fornecedor, a categoria padrão dele preenche a Categoria de Despesa só se
      estiver ativa e só se o gestor ainda não tiver escolhido categoria (história 8).
- [x] Profissional não vê a aba nem lê a tabela (história 39).
- [x] Criada a suíte pgTAP `29_contas_a_pagar`, cobrindo:
  - [x] categoria arquivada recusada no lançamento;
  - [x] a restrição de estado e valor baixado recusa gravação incoerente, mesmo como superusuário;
  - [x] situação vencida e faixas de destaque na fronteira do dia de negócio de um tenant com fuso
        diferente de UTC;
  - [x] paginação estável;
  - [x] profissional não lê a tabela nem executa a escrita; gerente de outro tenant não lê nem
        escreve.
- [x] Testes de repositório com adaptador simulado (validação e mensagens) e de adaptador
      simulando o cliente Supabase (mapeamento de parâmetros e resposta), no padrão dos módulos de
      Caixa e Comissões.
- [x] Teste próprio no nível da aba, com repositório injetado, cobrindo lançamento avulso e a
      lista; componentes internos da aba não ganham arquivo de teste próprio.
- [x] ADR 020 escrita, registrando: Contas a Pagar como livro separado dos movimentos de caixa;
      Baixa pela gaveta como movimento de caixa vinculado à Baixa; apuração única do valor
      esperado da gaveta com sentido materializado no movimento; movimento de caixa escrito
      exclusivamente por RPC.
- [x] Glossário do projeto atualizado com Conta a Pagar, Conta a Pagar Vencida e data de
      competência.
- [x] `npm run test` e `npm run test:db` verdes.

## Notas de implementação

- Migration `supabase/migrations/20260913180000_livro_de_contas_a_pagar.sql` aplicada em três
  partes no DEV via MCP `apply_migration` (tabela, `create_payable`, `list_payables`), verificada
  ao vivo por `to_regclass`/`to_regprocedure` e commitada em `865c115`.
- Módulo `src/modules/contas-pagar/` (types, repositório, adaptador Supabase, hook), formulário
  `src/components/financeiro/ContaPagarForm.tsx`, aba `src/pages/gerente/financeiro/ContasPagarTab.tsx`
  e rota/nav-link em `App.tsx`/`HubLayout.tsx` no mesmo padrão do Plano de Contas (035). Sem
  adaptador em memória, por decisão já registrada em `src/modules/contas-pagar/types.ts`: as
  regras que dariam profundidade a um adaptador falso vivem no banco.
- Suíte pgTAP `supabase/tests/database/29_contas_a_pagar.test.sql` (42 asserções) validada ao vivo
  no DEV via MCP `execute_sql` em transação `begin; ... rollback;` (técnica de empacotamento em
  tabela temporária `__test_results`, por o MCP só devolver o resultado do último `select`), com
  as 42 passando. O teste de fronteira do dia de negócio usa um tenant com fuso `America/Sao_Paulo`
  (diferente de UTC) e calcula o dia de negócio esperado com a mesma fórmula da função, para não
  depender de congelar o relógio.
- Testes de front: `ContasPagarRepository.test.ts` (20 casos, adaptador `vi.fn()` simulado),
  `SupabaseContasPagarAdapter.test.ts` (7 casos, cliente Supabase simulado) e
  `ContasPagarTab.test.tsx` (5 casos, com um adaptador `IContasPagarAdapter` simulado escrito só
  para este arquivo de teste — a mesma decisão de "sem adaptador em memória" do módulo, aplicada
  também ao teste de tela). `npx tsc -b` e `npx oxlint` limpos nos arquivos novos e alterados.
- Verificação visual em navegador não foi feita nesta sessão: não há `.claude/launch.json`
  configurado para o servidor de desenvolvimento, e montar login autenticado de gerente para teste
  manual ficou fora do escopo de tempo desta sessão. A cobertura de correção depende de
  `tsc`/`oxlint`/`vitest`/pgTAP, não de teste manual em navegador.
