# Mapeamento e Engenharia Reversa Estrutural: Módulo de Cadastros (AppBarber)

Este documento consolida a engenharia reversa completa, arquitetura de entidades relacionais, fluxos de validação, modais, formulários, integrações financeiras e catálogo exaustivo de endpoints de rede de todos os módulos e sub-módulos que integram a seção de **Cadastros (Master Data)** do sistema **AppBarber**.

---

## 1. Arquitetura Geral do Módulo de Cadastros

- **Framework Front-End:** Single Page Application em **AngularJS 1.4.0** com roteamento via **UI-Router** (`$stateProvider`), injeção dinâmica de dependências com **ocLazyLoad** e manipulação reativa com **jQuery 3.x** e **Select2**.
- **Controllers AngularJS Envolvidos:**
  - `clientesCtrl` (`/js/controllers/clientesCtrl.js?749` - 64 KB)
  - `profissionalCtrl` (`/js/controllers/profissionalCtrl.js?749` - 98 KB)
  - `servicosCtrl` (`/js/controllers/servicosCtrl.js?749` - 115 KB)
  - `pacotesCtrl` (`/js/controllers/pacotesCtrl.js?749` - 29 KB)
  - `pacotesVendaCtrl` (`/js/controllers/pacotesVendaCtrl.js?749` - 113 KB)
  - `categoriasCtrl` (`/js/controllers/categoriasCtrl.js?749`)
  - `tipoPagamentosCtrl` (`/js/controllers/tipoPagamentosCtrl.js?749` - 18 KB)
  - `despesasCtrl` (`/js/controllers/despesasCtrl.js?749` - 10 KB)
  - `receitasCtrl` (`/js/controllers/receitasCtrl.js?749` - 12 KB)
  - `subcontasCtrl` (`/js/controllers/subcontasCtrl.js?749`)
  - `equipamentosCtrl` (`/js/controllers/equipamentosCtrl.js?749` - 15 KB)
  - `fornecedoresCtrl` (`/js/controllers/fornecedoresCtrl.js?749` - 14 KB)
  - `tipoAnamneseCtrl` (`/js/controllers/tipoAnamneseCtrl.js?749`)
  - `tipoBandeiraCtrl` (`/js/controllers/tipoBandeiraCtrl.js?749`)
  - `tipoPessoaPagamentoCtrl` (`/js/controllers/tipoPessoaPagamentoCtrl.js?749`)
  - `tipoPessoaDeducaoCtrl` (`/js/controllers/tipoPessoaDeducaoCtrl.js?749`)
  - `mensagemPadraoCtrl` (`/js/controllers/mensagemPadraoCtrl.js?749` - 12 KB)
  - `tipoTransportadoraCtrl` (`/js/controllers/tipoTransportadoraCtrl.js?749`)
  - `mensagensCtrl` (`/js/controllers/mensagensCtrl.js?749`)
  - `noticiasCtrl` (`/js/controllers/noticiasCtrl.js?749` - 30 KB)
  - `gruposCtrl` (`/js/controllers/gruposCtrl.js?749` - 15 KB)
  - `pesquisaCtrl` (`/js/controllers/pesquisaCtrl.js?749`)
  - `lembretesCtrl` (`/js/controllers/lembretesCtrl.js?749` - 10 KB)
  - `estoqueCtrl` (`/js/controllers/estoqueCtrl.js?749` - 108 KB)
  - `clubeVantagensCtrl` (`/js/controllers/clubeVantagensCtrl.js?749` - 57 KB)
  - `cupomDescontoCtrl` (`/js/controllers/cupomDescontoCtrl.js?749` - 42 KB)
  - `assinaturasCtrl` (`/js/controllers/assinaturasCtrl.js?749` - 165 KB)
  - `assinantesCtrl` (`/js/controllers/assinantesCtrl.js?749` - 400 KB)
  - `profissionalJornadaCtrl` (`/js/controllers/profissionalJornadaCtrl.js?749`)
  - `profissionalServicoCtrl` (`/js/controllers/profissionalServicoCtrl.js?749`)
  - `contaClienteCtrl` (`/js/controllers/contaClienteCtrl.js?749` - 29 KB)

---

## 2. Mapa Estrutural da Seção de Cadastros

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                             ÁRVORE HIERÁRQUICA: CADASTROS                                    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│ 1. Clientes (#/clientes)                                                                     │
│    ├── Cadastro Completo & Foto                                                              │
│    ├── Tags / Etiquetas de Segmentação                                                       │
│    ├── Acessos ao Aplicativo & Reset de Senha                                                │
│    └── Conta Corrente do Cliente (Fiado / Créditos) (#/contacliente)                         │
│                                                                                              │
│ 2. Profissionais (#/profissionais)                                                           │
│    ├── Cadastro, Perfis de Acesso & Comissões Base                                           │
│    ├── Jornada Semanal de Trabalho (#/profissionaljornada)                                   │
│    ├── Serviços Habilitados & Comissões Específicas (#/profissionalservico)                  │
│    └── Remunerações Fixas & Deduções Folha                                                   │
│                                                                                              │
│ 3. Serviços (#/servicos)                                                                     │
│    ├── Tabela de Preços & Durações                                                           │
│    ├── Insumos de Estoque Vinculados (Baixa Automática)                                      │
│    ├── Sugestões de Venda Casada (Cross-Selling no App)                                      │
│    └── Preços Dinâmicos por Dia da Semana / Profissional                                     │
│                                                                                              │
│ 4. Pacotes (Submenu)                                                                         │
│    ├── 4.1. Meus Pacotes (#/pacotes) [Estrutura de Combos & Sessões]                         │
│    └── 4.2. Venda de Pacotes (#/pacotesVenda) [Checkout, Split & Saldo]                      │
│                                                                                              │
│ 5. Tipos de Apoio (Submenu com 13 Sub-módulos)                                               │
│    ├── 5.1. Categorias (#/categorias)                                                        │
│    ├── 5.2. Formas de Pagamento (#/tipopagamentos)                                           │
│    ├── 5.3. Categorias de Despesas (#/despesas)                                              │
│    ├── 5.4. Categorias de Receitas (#/receitas)                                              │
│    ├── 5.5. Subcontas / Caixas / Bancos (#/subcontas)                                        │
│    ├── 5.6. Equipamentos & Recursos da Agenda (#/equipamentos)                               │
│    ├── 5.7. Fornecedores (#/fornecedores)                                                    │
│    ├── 5.8. Tipos de Anamnese (#/tipoAnamnese)                                               │
│    ├── 5.9. Bandeiras de Cartão & Taxas (#/tipoBandeira)                                     │
│    ├── 5.10. Tipos de Remuneração (#/tipoRemuneracao)                                        │
│    ├── 5.11. Tipos de Dedução (#/tipoDeducao)                                                │
│    ├── 5.12. Mensagens Padrão (#/mensagemPadrao)                                             │
│    └── 5.13. Transportadoras (#/trasnportadora)                                              │
│                                                                                              │
│ 6. Produtos & Estoque (#/estoque)                                                            │
│    ├── Cadastro de SKU, EAN / Código de Barras & Preços                                      │
│    ├── Controle de Revenda vs Consumo Interno ("Para Uso")                                   │
│    ├── Movimentações, Entradas com NF & Ajustes                                              │
│    └── Inventário & Transferência entre Filiais                                              │
│                                                                                              │
│ 7. Clube de Assinaturas (Submenu)                                                            │
│    ├── 7.1. Planos de Assinatura (#/assinaturas) [MRR, Cotas & Regras]                       │
│    └── 7.2. Assinantes (#/assinantes) [Gateways Zoop / Galax Pay, Invoices & Estornos]       │
│                                                                                              │
│ 8. Cupons de Desconto (#/cupomDesconto)                                                      │
│ 9. Clube de Vantagens & Tiers (#/clubeVantagens)                                             │
│ 10. Notícias & Promoções do App (#/noticias e #/grupos)                                      │
│ 11. Pesquisa de Satisfação NPS (#/pesquisa)                                                  │
│ 12. Lembretes de Agendamento (#/lembretes)                                                   │
│ 13. Mensagens para Usuários (#/mensagens)                                                    │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Engenharia Reversa Detalhada por Módulo de Cadastro

---

### 3.1. Módulo: Clientes (`#/clientes` e `#/contacliente`)
- **Controllers:** `clientesCtrl.js` (64 KB) e `contaClienteCtrl.js` (29 KB)
- **Finalidade:** Gestão completa do ciclo de vida do cliente, fidelização, histórico de compras, crédito em conta e permissões de acesso ao App.
- **Formulário de Cadastro / Edição (`#cadastrarCliente-modal`):**
  - **Dados Pessoais:** `cliNome`, `cliCelular` (chave primária para deduplicação), `cliEmail`, `cliTelefone`, `cliCpf`, `cliRG`, `cliSexo` (M/F/Outro), `cliDataNascimento` (dispara ações de aniversário), `cliFoto`.
  - **Endereço Completo:** `cliCep` (busca assíncrona via ViaCEP), `cliEndereco`, `cliNumero`, `cliComplemento`, `cliBairro`, `cliCidade`, `cliEstado`.
  - **Acesso ao App:** `cliLoginId`, `cliSenha` (criptografada em MD5).
  - **Observações:** `cliObservacao` (visível na comanda e na agenda).
- **Sub-módulos e Recursos Integrados:**
  - **Tags / Etiquetas (`insereClienteTag.php`):** Segmentações visuais (ex: "VIP", "Cliente Exigente", "Atrasado", "Amigo").
  - **Conta Corrente do Cliente / Fiado (`#/contacliente`):** Controle de saldos devedores e credores (`buscaContaClientes.php`, `insereContaCliente_v6.php`).
  - **Pontuação Manual de Fidelidade (`inserePessoaPonto.php`):** Crédito e débito de pontos.
  - **Auditoria de Acessos (`CLIENTEBuscaAcessoLista.php`):** Registros de logins no App iOS/Android.
- **Endpoints Chave:**
  - `POST /pages/cadastros/buscaClientes_v4.php` (DataTable com paginação server-side)
  - `POST /pages/cadastros/insereClientes.php`
  - `POST /pages/cadastros/alteraClientesv3.php`
  - `POST /pages/cadastros/removeClientes.php`
  - `POST /pages/cadastros/reativaPessoa.php`
  - `POST /pages/cadastros/buscaClientesRemovidos.php`
  - `POST /pages/cadastros/alteraClienteImagem.php`
  - `POST /pages/cadastros/CLIENTEAlteraAcesso.php`

---

### 3.2. Módulo: Profissionais (`#/profissionais`, `#/profissionaljornada`, `#/profissionalservico`)
- **Controllers:** `profissionalCtrl.js` (98 KB), `profissionalJornadaCtrl.js`, `profissionalServicoCtrl.js`
- **Finalidade:** Gestão do corpo técnico de barbeiros e colaboradores, incluindo permissões de acesso, grades de horários e regras customizadas de repasse de comissão.
- **Formulário de Cadastro:**
  - **Dados Cadastrais:** Nome, Apelido de Atendimento, Celular, E-mail, CPF, RG, Chave PIX, Foto de Perfil.
  - **Regras Financeiras Base:** Percentual de Comissão Padrão sobre Serviços (`%`), Comissão sobre Venda de Produtos (`%`), Aluguel Fixo de Cadeira (se aplicável).
  - **Perfil de Acesso (`insereUsuarioPerfil.php`):** *Gestor Total*, *Recepção*, *Barbeiro Operacional (Acesso restrito apenas à sua própria agenda no App Pro)*.
- **Sub-telas Relacionadas:**
  1. **Jornada de Trabalho (`#/profissionaljornada`):**
     - Grade horária detalhada por dia da semana (Segunda a Domingo): Hora de Início, Início do Intervalo/Almoço, Fim do Intervalo, Hora de Saída (`insereProfissionalJornada.php`).
  2. **Serviços Habilitados & Comissões Específicas (`#/profissionalservico`):**
     - Seleciona quais serviços o barbeiro está apto a realizar, ajustando o tempo de execução individual e comissões diferenciadas (`insereServicoProfissional.php`, `alteraServicoProfissionalv2.php`).
  3. **Remunerações & Deduções (`tipoPessoaPagamento.php` e `tipoPessoaDeducao.php`):**
     - Lançamentos recorrentes em folha: Taxa de maquininha, taxa de lavatório, vale adiantamento, seguro.
- **Endpoints Chave:**
  - `POST /pages/cadastros/buscaProfissionais.php`
  - `POST /pages/cadastros/insereProfissionais_v3.php`
  - `POST /pages/cadastros/alteraProfissionais_v4.php`
  - `POST /pages/cadastros/removeProfissionais.php`
  - `POST /pages/cadastros/alteraProfissionalImagem.php`
  - `POST /pages/cadastros/buscaProfissionalJornadaWizard.php`
  - `POST /pages/cadastros/buscaServicoProfissionalWizardPro.php`

---

### 3.3. Módulo: Serviços (`#/servicos`)
- **Controller:** `servicosCtrl.js` (115 KB)
- **Finalidade:** Catálogo de procedimentos executados na barbearia.
- **Campos do Formulário:**
  - `serNome`: Nome do serviço (ex: "Corte Degradê Navalhado").
  - `serCategoria`: Categoria vinculada (Cabelo, Barba, Estética, Química).
  - `serTempo`: Duração em minutos (define o tamanho do bloco na agenda).
  - `serValor`: Preço de tabela em R$.
  - `serComissao`: Percentual padrão de repasse ao profissional (`%`).
  - `serPontos`: Pontos acumulados no programa de fidelidade.
  - `serDescricao`: Descrição comercial exibida no App do Cliente.
  - `serImagem`: Foto de capa do procedimento.
- **Recursos Avançados:**
  - **Insumos de Bancada Vinculados (`insereServicoProduto.php`):** Abate automático de estoque ao finalizar comanda (ex: 1 dose de pomada + 1 lâmina descartável).
  - **Preços Dinâmicos por Dia / Horário (`insereServicoValor.php`):** Tarifação promocional em dias de menor movimento (ex: Terça-feira com 20% de desconto).
  - **Venda Casada / Cross-Selling (`CROSS_SELLING_ITEM_Insere.php`):** Sugestão automática de produtos de revenda no App durante o fluxo de agendamento.
  - **Suporte a Barbeiro Auxiliar (`insereServicoAuxiliar.php`):** Divide o serviço entre o profissional principal e o lavador/assistente.
- **Endpoints Chave:**
  - `POST /pages/cadastros/buscaServicosv2.php`
  - `POST /pages/cadastros/insereServicosv2.php`
  - `POST /pages/cadastros/alteraServicosv2.php`
  - `POST /pages/cadastros/removeServicos.php`
  - `POST /pages/cadastros/alteraServicoImagem.php`
  - `POST /pages/cadastros/insereServicoProduto.php`
  - `POST /pages/cadastros/insereCombo.php`

---

### 3.4. Módulo: Produtos & Estoque (`#/estoque`)
- **Controller:** `estoqueCtrl.js` (108 KB)
- **Finalidade:** Gestão patrimonial de estoque, almoxarifado, controle de produtos para revenda e produtos de uso interno nas bancadas dos barbeiros.
- **Formulário de Cadastro:**
  - `proCodigoBarras`: EAN / Código de barras lido por leitor ótico.
  - `proNome`: Nome do produto.
  - `proCategoria`: Categoria (Pomadas, Shampoos, Óleos para Barba, Bebidas, Lâminas).
  - `proFornecedor`: Fornecedor parceiro.
  - `proPrecoCusto`: Custo de aquisição unitário (R$).
  - `proPrecoVenda`: Preço de venda ao consumidor (R$).
  - `proComissao`: Percentual de comissão de venda paga ao barbeiro (`%`).
  - `proEstoqueMinimo`: Ponto de pedido para alertas de reposição.
  - `proEstoqueAtual`: Quantidade em estoque.
  - `proTipo`: *Para Revenda* (comanda/checkout) vs *Para Uso Interno* (bancada).
  - `proValidade`: Data de vencimento do lote.
- **Movimentações & Operações de Estoque:**
  - **Entrada de Estoque (`insereEstoqueV4.php`):** Quantidade, custo, fornecedor, nota fiscal e integração automática com Contas a Pagar.
  - **Ajuste / Baixa Manual (`removeMovProduto.php`):** Baixas por quebra, avaria ou inventário.
  - **Transferência entre Filiais (`insereEstoqueTransferencia.php`).**
  - **Auditoria de Inventário (`PRODUTO_INVENTARIO_Insere.php`).**
- **Endpoints Chave:**
  - `POST /pages/cadastros/buscaProdutov4.php`
  - `POST /pages/cadastros/insereProdutov5.php`
  - `POST /pages/cadastros/alteraProdutov4.php`
  - `POST /pages/cadastros/removeProdutos.php`
  - `POST /pages/cadastros/buscaMovProduto.php`
  - `POST /pages/cadastros/insereEstoqueTransferencia.php`

---

### 3.5. Módulo: Pacotes (`#/pacotes` e `#/pacotesVenda`)
- **Controllers:** `pacotesCtrl.js` (29 KB) e `pacotesVendaCtrl.js` (113 KB)
- **Finalidade:** Criação e comercialização de pacotes de serviços antecipados (ex: "Combo 4 Cortes + 2 Barbas").
- **Fluxo Operacional:**
  1. **Configuração do Pacote (`#/pacotes`):** Define nome, validade em dias, valor global do pacote e lista de itens/sessões inclusas (`inserePacoteItens.php`).
  2. **Venda de Pacotes (`#/pacotesVenda`):** Associa o pacote ao cliente, seleciona o vendedor responsável (comissionamento da venda), forma de pagamento (Dinheiro, Cartão, PIX, Boleto) e credita o saldo de sessões na conta do cliente (`inserePessoaPacoteTipoPagamentov5.php`).
- **Endpoints Chave:**
  - `POST /pages/cadastros/buscaPacotes.php`
  - `POST /pages/cadastros/inserePacotes.php`
  - `POST /pages/cadastros/alteraPacotes.php`
  - `POST /pages/cadastros/buscaPacotePessoav3.php`
  - `POST /pages/cadastros/inserePessoaPacoteTipoPagamentov5.php`
  - `POST /pages/cadastros/alteraPacoteDataExpiracao.php`

---

### 3.6. Módulo: Clubes de Assinatura (`#/assinaturas` e `#/assinantes`)
- **Controllers:** `assinaturasCtrl.js` (165 KB) e `assinantesCtrl.js` (400 KB - O maior controlador do sistema!)
- **Finalidade:** Gestão completa de planos SaaS / Clubes Recorrentes com débito automático no cartão de crédito via gateways parceiros (**Zoop** e **Galax Pay**).
- **Estrutura de Planos (`#/assinaturas`):**
  - Definição do valor mensal (MRR), periodicidade de cobrança, limites contratuais de cortes/barbas e regras de comissionamento de repasse à equipe.
- **Gestão de Assinantes (`#/assinantes`):**
  - Contratação de assinaturas (`insereAssinaturaPessoav2.php`).
  - Geração de link de pagamento seguro / tokenização de cartão de crédito.
  - Consulta de faturas e invoices em tempo real (`buscaInvoice.php`, `buscaTransaction.php`).
  - Régua de retentativa e cobrança de inadimplentes (`CLIENTE_PLANO_ASSINATURA_FINANCEIRO_Recobrar.php`).
  - Cancelamento, suspensão e estorno direto no gateway (`cancelaAssinatura.php`, `estornaTransacao.php`).
- **Endpoints Chave:**
  - `POST /pages/cadastros/PLANO_ASSINATURA_Busca.php`
  - `POST /pages/cadastros/PLANO_ASSINATURA_Insere_v2.php`
  - `POST /pages/cadastros/buscaAssinaturaPessoa.php`
  - `POST /pages/cadastros/insereAssinaturaPessoav2.php`
  - `POST /pages/zoop/cancelaAssinatura.php`
  - `POST /pages/zoop/estornaTransacao.php`
  - `POST /pages/zoop/buscaInvoice.php`
  - `POST /pages/cadastros/CLIENTE_PLANO_ASSINATURA_Cancela.php`

---

### 3.7. Módulo: Cupons de Desconto (`#/cupomDesconto`)
- **Controller:** `cupomDescontoCtrl.js` (42 KB)
- **Finalidade:** Campanhas promocionais e cupons de desconto para marketing.
- **Regras Configuráveis:** Código do cupom, Tipo de desconto (Percentual `%` vs Valor Fixo em R$), Período de vigência (Data Início e Fim), Limite de usos globais e por cliente, Valor mínimo de pedido e restrições por categoria de serviço ou grupo de clientes.
- **Endpoints:** `POST /pages/cadastros/buscaCupomDescontov2.php`, `POST /pages/cadastros/insereCupomDescontov5.php`, `POST /pages/cadastros/removeCupom.php`.

---

### 3.8. Módulo: Clube de Vantagens & Grupos (`#/clubeVantagens` e `#/grupos`)
- **Controllers:** `clubeVantagensCtrl.js` (57 KB) e `gruposCtrl.js` (15 KB)
- **Finalidade:** Criação de categorias de fidelidade (Tiers Bronze, Prata, Ouro, Black) com tabelas de preços exclusivas e produtos gratuitos.
- **Endpoints:** `POST /pages/cadastros/buscaClubeCliente.php`, `POST /pages/cadastros/insereGrupoVantagens.php`, `POST /pages/cadastros/insereServicoGrupo.php`.

---

### 3.9. Submenu Tipos de Apoio (13 Sub-módulos Paramétricos)

| Sub-módulo | Rota SPA | Controller | Endpoint Principal | Finalidade |
| :--- | :--- | :--- | :--- | :--- |
| **Categorias** | `#/categorias` | `categoriasCtrl.js` | `/pages/cadastros/buscaCategoria.php` | Agrupamento de serviços e produtos |
| **Formas de Pagamento** | `#/tipopagamentos`| `tipoPagamentosCtrl.js` | `/pages/cadastros/insereTipoPagamento.php` | Dinheiro, PIX, Cartão, Boleto, Fiado, Cheque |
| **Bandeiras de Cartão** | `#/tipoBandeira` | `tipoBandeiraCtrl.js` | `/pages/cadastros/insereTipoBandeirav2.php`| Taxas percentuais e dias de repasse por bandeira |
| **Despesas (Plano Contas)**| `#/despesas` | `despesasCtrl.js` | `/pages/cadastros/insereDespesaCategoria.php`| Categorias de custos fixos e variáveis |
| **Receitas (Plano Contas)**| `#/receitas` | `receitasCtrl.js` | `/pages/cadastros/insereReceitaCategoria.php`| Categorias de receitas operacionais e extras |
| **Subcontas / Bancos** | `#/subcontas` | `subcontasCtrl.js` | `/pages/cadastros/insereSubContav2.php` | Gavetas de caixa e contas bancárias |
| **Equipamentos / Salas** | `#/equipamentos` | `equipamentosCtrl.js` | `/pages/cadastros/insereEquipamento.php` | Controle de recursos físicos da agenda |
| **Fornecedores** | `#/fornecedores` | `fornecedoresCtrl.js` | `/pages/cadastros/insereFornecedorv2.php` | Empresas parceiras, distribuidores e compras |
| **Tipos de Anamnese** | `#/tipoAnamnese` | `tipoAnamneseCtrl.js` | `/pages/cadastros/insereTipoAnamnese.php` | Modelos de fichas de saúde/estética |
| **Tipos de Remuneração** | `#/tipoRemuneracao`| `tipoPessoaPagamentoCtrl.js`| `/pages/cadastros/insereTipoPessoaPagamento.php`| Proventos fixos em folha de pagamento |
| **Tipos de Dedução** | `#/tipoDeducao` | `tipoPessoaDeducaoCtrl.js` | `/pages/cadastros/insereTipoPessoaDeducao.php` | Descontos fixos em folha (aluguel de cadeira, taxas) |
| **Mensagens Padrão** | `#/mensagemPadrao`| `mensagemPadraoCtrl.js` | `/pages/cadastros/insereMensagemLayout.php` | Textos e layouts padrão para WhatsApp, SMS e E-mail |
| **Transportadoras** | `#/trasnportadora`| `tipoTransportadoraCtrl.js`| `/pages/cadastros/insereTipoTransportadora.php`| Empresas de frete e entrega |

---

### 3.10. Comunicação, Notícias e Pesquisas
- **Notícias / Promoções (`#/noticias`):** Criação de posts e comunicados com foto, título e link exibidos no feed do App do Cliente (`insereNoticiasv2.php`).
- **Pesquisa de Satisfação NPS (`#/pesquisa`):** Configuração de formulários de avaliação de 1 a 5 estrelas disparados automaticamente (`inserePesquisaSatisfacao.php`).
- **Lembretes (`#/lembretes`):** Gerenciador de disparos de lembretes automáticos e manuais de agendamento via SMS, WhatsApp e E-mail (`buscaLembretes.php`).
