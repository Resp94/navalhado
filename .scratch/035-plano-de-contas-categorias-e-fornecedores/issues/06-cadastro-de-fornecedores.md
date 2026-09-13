# 06: Cadastro de Fornecedores

**What to build:** o gestor passa a ter num só lugar os dados de quem recebe pagamentos da
barbearia: nome, CPF ou CNPJ, telefone, e-mail, observação e a Categoria de Despesa padrão, para
que a conta do fornecedor já venha classificada quando for lançada na spec 036. Ele busca o
fornecedor por nome ou documento, arquiva quem deixou de atender e reativa se voltar — e consegue
cadastrar pelo celular, em cartões, na hora em que a mercadoria chega.

Hoje o fornecedor vive em textos soltos no motivo da sangria e da entrada de estoque, escrito de três
jeitos diferentes, sem como ver tudo que foi pago a ele.

**Nome e documento únicos por tenant, incluindo arquivados.** Fornecedor duplicado divide o
histórico de pagamentos, e o risco cresce com o cadastro rápido que a 036 vai oferecer dentro do
formulário de Conta a Pagar. Dois prestadores homônimos precisam de um complemento no nome
("João eletricista"). A regra é a mesma das categorias, para não haver duas regras a aprender.

**A integridade entre tenants fica no schema.** A categoria padrão é referenciada por chave
estrangeira composta sobre tenant e identificador: nenhuma escrita consegue apontar um fornecedor
para a categoria de outro tenant, não só a RPC.

**Contrato para a 036:** a leitura de fornecedor devolve a categoria padrão com o estado dela, e a
categoria padrão só pré-preenche a Conta a Pagar se estiver ativa.

Spec: `specs/035-plano-de-contas-categorias-e-fornecedores/spec.md`, seções "Entrega 2 —
Fornecedores", "Integridade entre tenants por chave composta", "Escrita por RPC, leitura por
tabela", "Acesso", "Índices", "Módulo" e "Entrega 3 — Aba Plano de contas".

**Blocked by:** 04 (Manutenção de Categorias de Despesa), 05 (Validação de CPF e CNPJ
alfanumérico).

**Status:** ready-for-agent

- [ ] Tabela de fornecedores por tenant com: nome de 2 a 120 caracteres, normalizado como o nome de
      categoria; documento opcional sem máscara; telefone opcional só com dígitos, 10 ou 11; e-mail
      opcional aparado e em minúsculas, validado pela mesma expressão do cadastro de usuário;
      observação opcional até 500 caracteres; categoria padrão opcional; carimbo único de
      arquivamento com autor; autoria e momento de criação e alteração.
- [ ] Restrição de verificação da coluna de documento usando a função do ticket 05: documento
      inválido é recusado mesmo em escrita direta como superusuário.
- [ ] Nome único por tenant sem diferenciar maiúsculas, incluindo arquivados.
- [ ] Documento único por tenant, incluindo arquivados, por índice único parcial onde o documento
      não é nulo; dois fornecedores sem documento não colidem.
- [ ] Unicidade adicional sobre tenant e identificador, e categoria padrão referenciada por chave
      estrangeira composta sobre tenant e categoria, com índice próprio com o tenant na frente.
- [ ] Colunas de autoria referenciam os usuários com anulação na exclusão e todo FK é indexado; sem
      índice parcial por estado de arquivamento.
- [ ] Política de SELECT no mesmo formato moderno das categorias; nenhuma política de escrita,
      privilégios de escrita direta revogados de autenticado e anônimo, anônimo sem privilégio. O
      profissional não lê nada.
- [ ] RPCs de Fornecedor, separadas e não um upsert: criar (campos), atualizar (fornecedor, campos),
      arquivar (fornecedor) e reativar (fornecedor), com o mesmo padrão de resolução de tenant,
      revalidação de papel, caminho de busca vazio, privilégios e registro de quem fez e quando das
      RPCs de categoria.
- [ ] Na criação, categoria padrão informada precisa ser Categoria de Despesa ativa do mesmo tenant.
      Na atualização, uma categoria padrão arquivada depois de definida é aceita se não mudou.
- [ ] Arquivar uma categoria não altera fornecedores que a usam como padrão.
- [ ] Atualizar fornecedor arquivado é recusado; arquivar o arquivado e reativar o ativo são
      recusados com mensagem própria. Arquivar não pede motivo e não há exclusão física.
- [ ] Criar ou atualizar para nome ou documento existente é recusado com erro de conflito que
      identifica o fornecedor existente e se ele está arquivado; violação de índice único sob
      concorrência também chega como conflito.
- [ ] Repositório expõe listar, criar, atualizar, arquivar e reativar fornecedor; normalização de
      nome, de telefone e de e-mail, validação e formatação de documento e tradução de erros ficam
      atrás dele. A leitura devolve a categoria padrão com o estado dela.
- [ ] O adaptador em memória reproduz também o conflito de documento.
- [ ] Controle segmentado Categorias de Despesa / Fornecedores na aba Plano de contas, com a seção
      refletida na URL como parâmetro de consulta, para que a 036 leve o gestor direto aos
      fornecedores.
- [ ] Seção de Fornecedores com ativos por padrão, filtro de arquivados com indicação visual e ação
      de reativar sem confirmação, ordem alfabética em português, tabela no desktop e cartões no
      celular no mesmo componente.
- [ ] Busca de fornecedor por nome e por documento, aceitando o documento com ou sem máscara; o
      documento aparece formatado na exibição.
- [ ] Formulário de fornecedor como componente autônomo (valores iniciais e repositório entram,
      registro salvo sai), composto no Drawer pela aba, sem props booleanas de modo. Valida e
      formata o documento enquanto o gestor digita e oferece como categoria padrão apenas
      categorias ativas.
- [ ] Arquivar fornecedor pede confirmação com texto de arquivamento: sai das opções de lançamento,
      histórico preservado, possível reativar.
- [ ] A confirmação de arquivamento de categoria passa a informar que fornecedores que a usam como
      padrão mantêm o vínculo, mas deixam de tê-la pré-preenchida.
- [ ] Conflito na criação com fornecedor arquivado oferece reativá-lo ali mesmo; com ativo, informa
      que já existe e aponta qual é.
- [ ] Casos no arquivo pgTAP do Plano de Contas: restrição de verificação recusa documento inválido
      em escrita direta como superusuário; documento único por tenant; nome único sem diferenciar
      maiúsculas, inclusive contra arquivado; categoria padrão de outro tenant recusada pelo FK
      composto; categoria padrão arquivada recusada na criação e aceita na atualização quando não
      mudou; arquivar e reativar com recusa de dupla operação e de atualizar arquivado; profissional
      não lê; gestor de outro tenant não lê; gestor sem INSERT, UPDATE nem DELETE direto; anônimo sem
      privilégio nem execução.
- [ ] Testes do repositório com adaptador falso (validação, normalização de telefone e e-mail,
      tradução de conflito de nome e de documento) e do adaptador Supabase.
- [ ] Teste da aba com o adaptador em memória: criar fornecedor, colidir com arquivado e reativar,
      arquivar com confirmação, buscar fornecedor por documento com e sem máscara, alternar seção
      pela URL.
- [ ] `CONTEXT.md` ganha o termo Fornecedor.
- [ ] `npm run test` e `npm run test:db` verdes.
