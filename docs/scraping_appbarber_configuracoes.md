# Mapeamento e Engenharia Reversa Estrutural: Módulo de Configurações (AppBarber)

Este documento consolida a engenharia reversa exaustiva, arquitetura de componentes, ciclo de vida dos dados, formulários, modais e catálogo completo de endpoints de rede de todos os módulos e sub-módulos que integram a seção de **Configurações** do sistema **AppBarber**.

---

## 1. Arquitetura Geral do Módulo de Configurações

- **Framework:** Single Page Application em **AngularJS 1.4.0** com roteamento via **UI-Router** (`$stateProvider`), carregamento dinâmico via **ocLazyLoad** e manipulação reativa com **jQuery 3.x**.
- **Controllers AngularJS Envolvidos:**
  - `parametrosCtrl` (`/js/controllers/parametrosCtrl.js?749`)
  - `rodizioCtrl` (`/js/controllers/rodizioCtrl.js?749`)
  - `filaCtrl` (`/js/controllers/filaCtrl.js?749`)
  - `listaDeEsperaCtrl` (`/js/controllers/listaDeEsperaCtrl.js?749`)
  - `anamneseCtrl` (`/js/controllers/anamneseCtrl.js?749`)
  - `documentosCtrl` (`/js/controllers/documentosCtrl.js?749`)
  - `clienteDocumentoCtrl` (`/js/controllers/clienteDocumentoCtrl.js?749`)
  - `profissionalDocumentoCtrl` (`/js/controllers/profissionalDocumentoCtrl.js?749`)
  - `preferenciasLocaisCtrl` (`/js/controllers/preferenciasLocaisCtrl.js?749`)
  - `avaliacoesCtrl` (`/js/controllers/avaliacoesCtrl.js?749`)
  - `restricaoClienteCtrl` (`/js/controllers/restricaoClienteCtrl.js?749`)
  - `funcionamentoEmpresaCtrl` (`/js/controllers/funcionamentoEmpresaCtrl.js?749`)
  - `alertaCtrl` (`/js/controllers/alertaCtrl.js?749`)

---

## 2. Mapa Estrutural da Seção de Configurações

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                            ÁRVORE HIERÁRQUICA: CONFIGURAÇÕES                                 │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│ 1. Parâmetros Globais do Sistema (#/parametros) [70 Parâmetros Operacionais]                 │
│ 2. Rodízio de Profissionais (#/rodizio)                                                      │
│ 3. Ordem de Chegada (Submenu)                                                                │
│    ├── 3.1. Fila de Espera em Tempo Real (#/filaDeEspera)                                    │
│    └── 3.2. Histórico de Fila (#/relFilas)                                                   │
│ 4. Lista de Espera de Agendamentos (#/listaDeEspera)                                         │
│ 5. Anamnese (Submenu)                                                                        │
│    ├── 5.1. Fichas & Formulários (#/formularios)                                             │
│    └── 5.2. Histórico por Cliente (#/anamnese/{codigo})                                      │
│ 6. Documentos & Contratos (Submenu)                                                          │
│    ├── 6.1. Meus Documentos & Modelos (#/documentos)                                         │
│    ├── 6.2. Documentos de Clientes (#/clientedocumento/{codigo})                             │
│    └── 6.3. Documentos de Profissionais (#/profissionaldocumento/{codigo})                   │
│ 7. Preferências Locais de Navegador (#/preferenciasLocais)                                   │
│ 8. Avaliações dos Clientes (NPS & Feedback) (#/avaliacoes)                                   │
│ 9. Lista de Restrições & Bloqueios (#/restricaoCliente)                                      │
│ 10. Funcionamento da Empresa / Fechamento Coletivo (#/funcionamentoEmpresa)                  │
│ 11. Alertas & Comunicados Internos (#/alertas)                                               │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Engenharia Reversa Detalhada por Módulo

---

### 3.1. Parâmetros Globais do Sistema (`#/parametros`)
- **Controller:** `parametrosCtrl.js` (`/pages/cadastros/parametros.php`)
- **Finalidade:** O cérebro operacional do AppBarber. Define regras rígidas de segurança, cálculo de comissões, permissões de usuários não-gestores, integrações de comunicação (WhatsApp, SMS, E-mail) e limites de agendamento online.
- **Estrutura de Persistência:**
  - `POST /pages/cadastros/atualizaParametro.php`: Salva o valor selecionado/digitado para o parâmetro (`parCodigo`, `parValor`, `pvpCodigo`).
  - `POST /pages/cadastros/removeParametro.php`: Restaura o parâmetro para o padrão do sistema (`parCodigo`, `pvpCodigo`).

#### Catálogo dos 70 Parâmetros Operacionais Mapeados:
| Código (`Par_Codigo`) | Descrição e Comportamento Operacional | Tipo de Entrada |
| :--- | :--- | :--- |
| `1` | Dias para Data de Expiração de Pontos no Programa de Fidelidade (30 a 3650 dias / Nunca) | Select |
| `3` | Limite de tolerância para o cliente cancelar agendamento pelo App (15 min a 48h) | Select |
| `5` | Tempo padrão (em minutos) dos slots da agenda (10, 15, 20, 30, 40, 45, 60 min) | Select |
| `6` | Tema/Layout WebAdmin (skin-blue, skin-yellow, skin-purple, skin-green, skin-black) | Select |
| `9` | Limite de antecedência para agendar pelo App (10 min a 3 dias antes) | Select |
| `10` | Habilitar envio de mensagem quando agendar/cancelar pelo Aplicativo (Sim/Não) | Select |
| `13` | Permitir agendamento no mesmo horário pelo cliente no Aplicativo (Sim/Não) | Select |
| `15` | Obrigatoriedade de seleção da bandeira do cartão na comanda e pacotes (Sim/Não) | Select |
| `16` | Limite de agendamento futuro pelo cliente no App (em dias) | Input Numérico |
| `17` | Bloquear cancelamento de horários por profissionais não-gestores (Desabilitado / App / Web / Ambos) | Select |
| `18` | Aprovar solicitação de cadastro de novo cliente automaticamente (Sim/Não) | Select |
| `19` | No App, exibir comandas abertas SOMENTE para profissionais envolvidos e gestores | Select |
| `20` | Habilitar fechamento de comanda no Aplicativo para usuários não-gestores (Sim/Não) | Select |
| `22` | Permitir inserção de comandas de profissionais no caixa | Select |
| `23` | Campo de edição de comissões na comanda (Mostrar / Bloquear / Não Mostrar) | Select |
| `26` | Impedir agendamento de horários pelo App por profissionais não-gestores | Select |
| `27` | Ativar baixa automática do Contas a Receber na data de vencimento | Select |
| `28` | Ativar controle de clientes por número de celular (unificação de cadastros) | Select |
| `30` | Tempo (em horas) para envio de lembrete automático de agendamento | Input Numérico |
| `32` | Tipografia da interface WebAdmin (Inter, Roboto, Montserrat, Quicksand, etc.) | Select |
| `33` | Contabilizar pontos de fidelidade apenas para agendamentos feitos online | Select |
| `37` | Ativar envio automático de lembrete via SMS | Select |
| `38` | Envio automático de mensagens de aniversário via Notificação Push no App | Select |
| `40` | Ocultar telefone do cliente no App e ChatBot para usuários não-gestores | Select |
| `42` | Limite de dias para registrar agendamentos retroativos/passados | Input Numérico |
| `44` | Exibir lista geral de clientes no App para usuários não-gestores | Select |
| `45` | Permitir cadastro de novos clientes no App por não-gestores | Select |
| `46` | Habilitar troca de profissional da agenda no App por não-gestores | Select |
| `47` | Desativar envio de e-mails de confirmação de agendamento | Select |
| `48` | Proibir reabertura de caixa fechado por não-gestores | Select |
| `49` | Proibir reabertura de comanda finalizada por não-gestores | Select |
| `52` | Enviar link de confirmação no lembrete via WhatsApp/SMS/E-mail | Select |
| `53` | Bloquear opção de travar/bloquear grade horária por não-gestores | Select |
| `55` | Habilitar suporte a barbeiro auxiliar / assistente | Select |
| `56` | Ativar envio de mensagens de aniversário via SMS | Select |
| `57` | Ativar envio de mensagens de retorno pós-atendimento via SMS | Select |
| `58` | Ativar controle restritivo de jornada (Jornada × Profissional × Serviço) | Select |
| `143`| Exibir opção "Sem Preferência" na lista de profissionais para agendamento online | Select |
| `61` | Enviar notificação de novo agendamento/cancelamento para todos os gestores | Select |
| `62` | Associação automática de sessões de pacotes ao agendar serviço correspondente | Select |
| `63` | Habilitar controle de caixinha / gorjeta para a equipe | Select |
| `69` | Exibir botão "Ver Dia" (auditoria rápida de movimentações) no fechamento de caixa | Select |
| `74` | Zerar comissão do profissional quando o serviço for resgate de fidelidade | Select |
| `75` | Proibir agendamento avulso sem cliente vinculado por não-gestores | Select |
| `76` | Proibir criação de encaixes na agenda por não-gestores | Select |
| `77` | Não gerar comissão na comanda para serviços vinculados a pacotes comissionados | Select |
| `81` | Ativar envio automático de lembretes de agendamento via WhatsApp | Select |
| `88` | Limite diário de agendamentos do mesmo serviço por cliente | Input Numérico |
| `89` | Fuso Horário do Estabelecimento (América/São_Paulo, etc.) | Select IANA |
| `90` | Exibir vitrine de produtos de revenda no App do Cliente e Site | Select |
| `97` | Envio automático de régua de retorno pós-corte via WhatsApp | Select |
| `110`| Envio automático de felicitações de aniversário via WhatsApp | Select |
| `99` | Desativar completamente o programa de fidelidade do salão | Select |
| `43` | Horário de início da grade diária da agenda (00:05 às 23:55) | Select Hora |
| `113`| Exibir movimentações de caixa no App Pro para profissionais não-gestores | Select |
| `115`| Em clubes de assinatura, calcular comissão sobre o valor cheio original do serviço | Select |
| `114`| Não gerar repasse de comissão para itens marcados como cortesia (100% off) | Select |
| `107`| Tamanho visual dos slots da agenda na interface web | Select |
| `121`| Limite máximo de agendamentos futuros simultâneos em aberto por cliente | Input Numérico |
| `128`| Envio automático de mensagem de aniversário via E-mail | Select |
| `133`| Horário de encerramento da grade diária da agenda | Select Hora |
| `134`| Notificar cliente via App quando um pacote adquirido estiver prestes a expirar | Select |
| `140`| Bloquear edição de agendamento já criado por não-gestores | Select |
| `135`| Disparo automático de pesquisa de satisfação (NPS) via WhatsApp após o corte | Select |
| `145`| Proibir abertura avulsa de comanda por não-gestores | Select |
| `141`| Agrupar profissionais por categoria na visualização da agenda | Select |
| `173`| Ocultar opção "Não quero conversar durante o corte" no App do Cliente | Select |
| `166`| Permitir planos de assinatura válidos apenas para dias específicos da semana | Select |
| `79` | Exibir nota de avaliação pública individual no perfil de cada barbeiro | Select |
| `226`| Proibir desbloqueio de horários travados por profissionais não-gestores | Select |

---

### 3.2. Rodízio de Profissionais (`#/rodizio`)
- **Controller:** `rodizioCtrl.js` (`/pages/cadastros/rodizio.php`)
- **Finalidade:** Gestão de fila sequencial justa (roleta) para distribuir clientes sem preferência entre os barbeiros da casa.
- **Funcionamento:**
  - Separação por **Categorias** (ex: Barbeiro Tradicional vs Master).
  - Controle de abertura de rodízio diário (`btnAbrirRodizio`).
  - Ordenação dinâmica: quando um profissional atende, ele é movido para o fim da fila.
- **Endpoints:**
  - `POST /pages/cadastros/buscaRodizio.php`
  - `POST /pages/cadastros/insereRodizio.php`
  - `POST /pages/cadastros/atualizaRodizio.php`
  - `POST /pages/cadastros/buscaRodizioProfissional.php`
  - `POST /pages/cadastros/insereRodizioProfissional.php`

---

### 3.3. Ordem de Chegada / Fila de Espera (`#/filaDeEspera`)
- **Controller:** `filaCtrl.js` (`/pages/cadastros/fila.php`)
- **Finalidade:** Controle de salão para estabelecimentos que atendem por ordem de chegada (walk-in) ou totem de autoatendimento.
- **Fluxo Operacional:**
  1. Abertura da Fila diária (`abreFila()`).
  2. Adição de cliente na fila (`#insereClienteFila-modal`): seleciona cliente ou cadastra novo na hora, com observações e preferência de profissional.
  3. Chamada de atendimento e abertura automática de Comanda vinculada à fila (`#cadastrarComandaFila-modal` via `insereComandaFila.php`).
- **Endpoints:**
  - `POST /pages/cadastros/buscaFila.php`
  - `POST /pages/cadastros/insereFila.php`
  - `POST /pages/cadastros/atualizaFilav2.php`
  - `POST /pages/cadastros/insereFilaMovimentacao.php`
  - `POST /pages/cadastros/insereComandaFila.php`

---

### 3.4. Lista de Espera de Agendamentos (`#/listaDeEspera`)
- **Controller:** `listaDeEsperaCtrl.js` (`/pages/cadastros/listaDeEspera.php`)
- **Finalidade:** Lista de desejos para clientes que não encontraram horários vagos em uma determinada data. Quando ocorre um cancelamento na agenda, a recepção consulta a lista de espera para encaixar o próximo cliente.
- **Modais:**
  - `#insereClienteLista-modal`: `pesCodigoCliente`, `servico`, `DataLista`, `pescodigoprofissional`, `ObsLista`.
  - `#alteraClienteLista-modal`: Edição da solicitação.
  - `#cadastrarCliente-modal`: Cadastro completo de novo cliente em modal embutido.
- **Endpoints:**
  - `POST /pages/cadastros/insereListaEspera.php`
  - `POST /pages/cadastros/alteraListaEspera.php`
  - `POST /pages/cadastros/removeListaEspera.php`

---

### 3.5. Anamnese (Formulários & Clientes)
- **Controller:** `anamneseCtrl.js` (`/pages/cadastros/anamnese.php`)
- **Finalidade:** Fichas de saúde, procedimentos químicos (progressiva, descoloração, estética capilar), alergias e histórico dermatológico.
- **Componentes:**
  - **Formulários:** Criação de campos customizados (perguntas dissertativas, checkbox, radio e anexos de fotos antes/depois).
  - **Clientes (`#/anamnese/{codigo}`):** Histórico de fichas preenchidas do cliente com assinatura digital via canvas.
- **Endpoints:**
  - `POST /pages/cadastros/buscaFormularioAnamnese.php`
  - `POST /pages/cadastros/buscaPessoaAnamnese.php`
  - `POST /pages/cadastros/inserePessoaAnamnese.php`
  - `POST /pages/cadastros/inserePessoaAnamneseResposta.php`
  - `POST /pages/cadastros/alteraPessoaAnamneseResposta.php`
  - `POST /pages/cadastros/removePessoaAnamnese.php`

---

### 3.6. Documentos & Contratos
- **Controllers:** `documentosCtrl.js`, `clienteDocumentoCtrl.js`, `profissionalDocumentoCtrl.js`
- **Telas:**
  - `#/documentos`: Cadastro de minutas e contratos padrão.
  - `#/clientedocumento/{codigo}`: Vínculo e assinatura de termos com clientes.
  - `#/profissionaldocumento/{codigo}`: Vínculo e assinatura de contratos de parceria / aluguel de cadeira / CLT com os barbeiros.
- **Tags Dinâmicas Suportadas:** `[NOME_CLIENTE]`, `[CPF]`, `[RG]`, `[ENDERECO]`, `[SERVICO]`, `[VALOR]`, `[DATA]`.
- **Endpoints:**
  - `POST /pages/cadastros/insereDocumento.php`
  - `POST /pages/cadastros/buscaDocumento.php`
  - `POST /pages/cadastros/alteraDocumento.php`
  - `POST /pages/cadastros/removeDocumento.php`
  - `POST /pages/cadastros/buscaPessoaDocumento.php`
  - `POST /pages/cadastros/removePessoaDocumento.php`

---

### 3.7. Preferências Locais (`#/preferenciasLocais`)
- **Controller:** `preferenciasLocaisCtrl.js` (`/pages/cadastros/preferenciasLocais.php`)
- **Finalidade:** Parâmetros persistidos no `localStorage` do navegador da máquina atual:
  - `optWhats`: Abrir o executável nativo do WhatsApp Desktop ao invés do WhatsApp Web.
  - `optExitMsg`: Desativar diálogo de confirmação ao fechar a aba (`onbeforeunload`).
  - `optNotShowInfoDates`: Desativar decorações e banners comemorativos (Natal, Halloween).
  - `optMsgAlerta`: Ocultar balões de pendências laterais na abertura da sessão.
  - `optCookieAnalytics`: Consentimento de telemetria e gravação de sessão LGPD.

---

### 3.8. Avaliações dos Clientes (NPS & Feedback) (`#/avaliacoes`)
- **Controller:** `avaliacoesCtrl.js` (`/pages/cadastros/avaliacoes.php`)
- **Finalidade:** Gestão de satisfação do cliente (NPS) com notas de 1 a 5 estrelas disparadas automaticamente após o atendimento via WhatsApp.
- **Endpoints:**
  - `POST /pages/cadastros/buscaPessoaAvaliacao.php`
  - `POST /pages/cadastros/buscaPessoaAvaliacaoDetalhes.php`
  - `POST /pages/cadastros/insereRespostaAvaliacao.php`
  - `POST /pages/cadastros/removeRespostaAvaliacao.php`

---

### 3.9. Lista de Restrições & Bloqueios (`#/restricaoCliente`)
- **Controller:** `restricaoClienteCtrl.js` (`/pages/cadastros/restricaoCliente.php`)
- **Finalidade:** Gestão de clientes indesejados (no-shows recorrentes, comportamento inadequado ou inadimplência).
- **Tipos de Restrição:**
  1. **Bloqueio Geral:** O cliente é impedido de realizar qualquer agendamento no App/Web.
  2. **Bloqueio Parcial / Por Profissional:** O cliente fica bloqueado para agendar com o Barbeiro A, mas permanece liberado para outros profissionais.
- **Endpoints:**
  - `POST /pages/cadastros/buscaClienteBloqueio.php`
  - `POST /pages/cadastros/insereClienteBloqueio.php`
  - `POST /pages/cadastros/insereClienteBloqueioProfissional.php`
  - `POST /pages/cadastros/removeClienteBloqueio.php`

---

### 3.10. Funcionamento da Empresa / Fechamentos Coletivos (`#/funcionamentoEmpresa`)
- **Controller:** `funcionamentoEmpresaCtrl.js` (`/pages/cadastros/funcionamentoEmpresa.php`)
- **Finalidade:** Cadastro de feriados, recessos, manutenções do espaço e eventos que suspendem o atendimento de toda a equipe em lote, exibindo mensagem explicativa no aplicativo do cliente.
- **Endpoints:**
  - `POST /pages/cadastros/buscaFuncionamentoEmpresa.php`
  - `POST /pages/cadastros/insereFuncionamentoEmpresa.php`
  - `POST /pages/cadastros/alteraEmpresaFuncionamento.php`
  - `POST /pages/cadastros/removeFuncionamentoEmpresa.php`

---

### 3.11. Alertas & Comunicados Internos (`#/alertas`)
- **Controller:** `alertaCtrl.js` (`/pages/cadastros/alertas.php`)
- **Finalidade:** Mural de avisos da diretoria. Cria comunicados com título, corpo e data de expiração (`EAlDataFim`) que são exibidos como modal obrigatório ao logar no sistema.
- **Endpoints:**
  - `POST /pages/cadastros/ALERTA_EMPRESA_Busca.php`
  - `POST /pages/cadastros/ALERTA_EMPRESA_Insere.php`
  - `POST /pages/cadastros/ALERTA_EMPRESA_Altera.php`
  - `POST /pages/cadastros/ALERTA_EMPRESA_Remove.php`

---

## 4. Tabela Consolidada de Endpoints do Módulo de Configurações

| Módulo / Sub-módulo | Rota SPA | Endpoint Principal (POST) | Ação Principal |
| :--- | :--- | :--- | :--- |
| **Parâmetros** | `#/parametros` | `/pages/cadastros/atualizaParametro.php` | Salva parâmetro operacional (1 a 70) |
| **Rodízio** | `#/rodizio` | `/pages/cadastros/insereRodizio.php` | Abre/Organiza roleta da equipe |
| **Fila em Tempo Real** | `#/filaDeEspera` | `/pages/cadastros/insereFila.php` | Adiciona cliente na ordem de chegada |
| **Abertura Comanda Fila** | `#/filaDeEspera` | `/pages/cadastros/insereComandaFila.php` | Converte posição da fila em Comanda |
| **Lista de Espera** | `#/listaDeEspera` | `/pages/cadastros/insereListaEspera.php` | Cadastra intenção para grade lotada |
| **Anamnese Formulários** | `#/formularios` | `/pages/cadastros/buscaFormularioAnamnese.php` | Lista fichas de avaliação |
| **Anamnese Respostas** | `#/anamnese/{codigo}` | `/pages/cadastros/inserePessoaAnamneseResposta.php`| Grava respostas e assinatura |
| **Documentos Modelos** | `#/documentos` | `/pages/cadastros/insereDocumento.php` | Salva minuta/contrato com tags |
| **Documentos Assinatura** | `#/clientedocumento/` | `/pages/cadastros/buscaPessoaDocumento.php` | Assina documento eletronicamente |
| **Preferências Locais** | `#/preferenciasLocais`| `localStorage` | Salva flags de UI do navegador |
| **Avaliações (NPS)** | `#/avaliacoes` | `/pages/cadastros/buscaPessoaAvaliacao.php` | Lista notas e comentários de clientes |
| **Bloqueio de Clientes** | `#/restricaoCliente` | `/pages/cadastros/insereClienteBloqueio.php` | Bloqueia cliente no App/Web |
| **Fechamento Coletivo** | `#/funcionamentoEmpresa`| `/pages/cadastros/insereFuncionamentoEmpresa.php` | Bloqueia grade em feriados |
| **Alertas Internos** | `#/alertas` | `/pages/cadastros/ALERTA_EMPRESA_Insere.php` | Publica comunicado com validade |
