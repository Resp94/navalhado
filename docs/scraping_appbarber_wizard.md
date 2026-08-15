# Mapeamento e Scraping Estrutural Profundo: Onboarding Wizard (AppBarber)

Este documento apresenta o mapeamento estrutural detalhado, hierarquia de componentes DOM, validações em tempo de execução, catálogo de dados, comportamentos reativos, schemas reais de banco de dados e endpoints de integração do assistente de configuração inicial (**Wizard de Onboarding**) do AppBarber.

---

## 1. Metadados e Arquitetura da Página

- **URL da Aplicação:** `https://sistema.appbarber.com.br/wizard/`
- **Título do Documento:** `AppBarber - Passo a Passo Inicial`
- **Função no Sistema:** Assistente obrigatório pós-cadastro inicial para parametrização do estabelecimento antes de liberar o acesso à tela principal (`/index.php`).
- **Frameworks e Bibliotecas Utilizadas:**
  - **Framework de Estilo:** Bootstrap 5.x + KeenThemes Metronic 8 Theme
  - **Motor de Stepper:** `KTStepper` (KeenThemes Stepper Plugin)
  - **Manipulação de DOM:** jQuery 3.x
  - **Validação de Formulários:** `FormValidation` (plugins `Trigger` e `Bootstrap5`)
  - **Componentes de Dropdown / Autocomplete:** `Select2` com suporte a busca e ícones/flags customizadas
  - **Formatação e Máscaras de Entrada:** `Inputmask`
  - **Notificações:** `Toastr` (posicionado em `toastr-bottom-center`) + `SweetAlert2`
  - **APIs Externas Integradas:**
    - **ViaCEP:** `https://viacep.com.br/ws/{cep}/json/`
    - **Google Maps Geocoding API:** `https://maps.googleapis.com/maps/api/geocode/json`

---

## 2. Ciclo de Vida e Estados do Stepper (`KTStepper`)

O fluxo é gerenciado por uma instância de `KTStepper` ancorada no container `#kt_create_account_stepper`.

### Estados dos Itens de Navegação (`.stepper-item`):
- `current`: Etapa ativa e visível no momento (destacada em azul com número visível).
- `completed`: Etapa anterior já concluída com sucesso (exibe ícone de *check* `fas fa-check`).
- `pending`: Etapa futura ainda bloqueada.

### Controles Globais de Navegação:
- **Botão Voltar (`ktStepper.btnPrevious`):**
  - Seletor: `.btn-light-primary`
  - Comportamento: Dispara `ktStepper.goPrevious()`.
  - Visibilidade: Oculto no Passo 1, visível nos Passos 2, 3 e 4.
- **Botão Continuar (`ktStepper.btnNext`):**
  - Seletor: `.btn-primary` (texto "Continuar")
  - Comportamento: Valida os campos da etapa ativa, dispara as requisições AJAX do passo e, mediante retorno de sucesso (`erro == "0"`), executa `ktStepper.goNext()`.
  - Estado de Carregamento: Recebe atributo `data-kt-indicator="on"` e `disabled="true"` durante requisições.
  - Visibilidade: Visível nos Passos 1, 2 e 3; ocultado no Passo 4.
- **Botão Finalizar (`ktStepper.btnSubmit`):**
  - Seletor: `.btn-primary` (texto "Finalizar")
  - Comportamento: Dispara a sequência de consolidação do cadastro e redireciona para o painel principal.
  - Visibilidade: Oculto nos Passos 1, 2 e 3; exibido exclusivamente no Passo 4.

---

## 3. Detalhamento Passo a Passo

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      BARRA DE ETAPAS (STEPPER NAV)                     │
 │  [ 1. Localização ] ──> [ 2. Segmentação ] ──> [ 3. Serviços ] ──> [ 4. Profissionais ]
 └────────────────────────────────────┬───────────────────────────────────┘
                                      │
 ┌────────────────────────────────────▼───────────────────────────────────┐
 │                   PAINEL DE FORMULÁRIO (#kt_create_account_form)       │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │  📍 PASSO 1: LOCALIZAÇÃO (#stepAddress)                                │
 │     • País (Select2 com 29 bandeiras S3)                               │
 │     • CEP (Máscara dinâmica + Auto-lookup ViaCEP)                      │
 │     • Endereço, Bairro, Número                                         │
 │     • Estado & Cidade (Combos encadeados via AJAX)                     │
 │     ➔ Avanço: Geocodificação Google Maps (Lat/Lng) + POST Endereço    │
 │                                                                        │
 │  📊 PASSO 2: SEGMENTAÇÃO (#stepDataEstablishment)                      │
 │     • Preço Base do Corte (Máscara monetária R$)                       │
 │     • Canal de Origem / "Como Soube" (44 fontes/influenciadores)       │
 │     • Porte da Equipe (Radios: 1, 2 a 5, 6 a 15, +15)                  │
 │     ➔ Avanço: POST Segmentação                                         │
 │                                                                        │
 │  ✂️ PASSO 3: SERVIÇOS (#stepServices)                                  │
 │     • Formulário de Adição: Descrição, Valor, Duração (15-300 min)     │
 │     • Tabela Dinâmica com Remoção (Ajax DELETE/GET)                    │
 │     ➔ Avanço: Validação de no mínimo 1 serviço cadastrado              │
 │                                                                        │
 │  💈 PASSO 4: PROFISSIONAIS (#stepProfessionals)                        │
 │     • Formulário de Adição: Nome, Celular                              │
 │     • Tabela Dinâmica (Trava de segurança: oculta botão de exclusão   │
 │       caso reste apenas 1 profissional)                                │
 │     ➔ Finalização: 4 chamadas sequenciais + Redirecionamento           │
 │                                                                        │
 └────────────────────────────────────────────────────────────────────────┘
```

---

### 📍 Passo 1: Localização do Estabelecimento (`#stepAddress`)

Configura o endereço físico da barbearia, geocodificando para exibição em mapas de agendamento online.

#### 1. Catálogo Completo de Países (`#country`):
Total de 29 países cadastrados com bandeiras hospedadas no bucket S3 da AWS (`https://appbarber-appbeleza-assets.s3.sa-east-1.amazonaws.com/imgsystem/flags/`):
- `1`: **Brasil** (Padrão - `brazil.svg`)
- `2`: **Portugal** (`portugal.svg`)
- `3`: **Suiça** (`switzerland.svg`)
- `4`: **Estados Unidos** (`united-states.svg`)
- `5`: **México** (`mexico.svg`)
- `6`: **Panamá** (`panama.svg`)
- `7`: **Cabo Verde** (`cape-verde.svg`)
- `8`: **Austrália** (`australia.svg`)
- `9`: **Angola** (`angola.svg`)
- `10`: **Paraguai** (`paraguay.svg`)
- `11`: **Bolívia** (`bolivia.svg`)
- `12`: **Chile** (`chile.svg`)
- `13`: **Irlanda** (`ireland.svg`)
- `14`: **Moçambique** (`mozambique.svg`)
- `15`: **Holanda** (`netherlands.svg`)
- `16`: **Equador** (`ecuador.svg`)
- `17`: **Japão** (`japan.svg`)
- `18`: **Inglaterra** (`england.svg`)
- `19`: **França** (`france.svg`)
- `20`: **Uruguai** (`uruguay.svg`)
- `21`: **República Tcheca** (`czech-republic.svg`)
- `22`: **Bélgica** (`belgium.svg`)
- `23`: **Canadá** (`canada.svg`)
- `24`: **Itália** (`italy.svg`)
- `25`: **Argentina** (`argentina.svg`)
- `26`: **Guatemala** (`guatemala.svg`)
- `27`: **Espanha** (`spain.svg`)
- `28`: **Equatorial Guinea** (`equatorial-guinea.svg`)
- `29`: **Alemanha** (`germany.svg`)

#### 2. Campos do Formulário e Regras de Validação:
| Campo | ID / Name | Tipo | Regra de Validação (`FormValidation`) | Mensagem de Erro |
| :--- | :--- | :--- | :--- | :--- |
| **País** | `#country` | `select` | Obrigatório | *(Gerenciado por seleção)* |
| **CEP** | `#cep` | `input[text]` | `notEmpty` | *"O campo CEP é Obrigatório."* |
| **Endereço** | `#endereco` | `input[text]` | `notEmpty` | *"O campo Endereço é Obrigatório."* |
| **Estado** | `#estado` | `select` | `notEmpty` | *"O campo Estado é Obrigatório."* |
| **Cidade** | `#cidade` | `select` | `notEmpty` | *"O campo Cidade é Obrigatório."* |
| **Bairro** | `#bairro` | `input[text]` | `notEmpty` | *"O campo Bairro é Obrigatório."* |
| **Número** | `#numero` | `input[text]` | `notEmpty` | *"O campo Número do Endereço é Obrigatório."* |

#### 3. Comportamentos Reativos e AJAX:
- **Evento `#country.change`:**
  - Se `Brasil` (`value == "1"`): aplica máscara `99999-999` para CEP e `(99) 99999-9999` para celular.
  - Se outro país: aplica máscara genérica `9{1,12}` para CEP e `9{1,20}` para celular.
  - Dispara `buscaEstados(paicodigo)` via `POST ../pages/cadastros/buscaEstadoPais.php`.
- **Evento `#cep.keyup`:**
  - Ao atingir 8 dígitos não mascarados no Brasil, dispara `GET https://viacep.com.br/ws/${cep}/json/`.
  - Popula automaticamente `#endereco`, `#bairro`, seleciona a UF em `#estado` (disparando o carregamento da cidade) e seleciona a `#cidade`.
- **Evento `#estado.change`:**
  - Dispara `buscaCidade(estCodigo)` via `POST ../pages/cadastros/buscaCidadesCombo.php`.
  - Popula o combo `#cidade` e coloca o foco em `#numero`.

#### 4. Submissão da Etapa 1:
Ao clicar em "Continuar", a aplicação executa:
1. Validação de todos os campos.
2. Consulta de Geocodificação:
   ```
   GET https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyCK6WvkAL7bqWyh5cElIZ8WZpE9fLwodgE&address={endereco},{bairro},{numero},{cidade},{estado}
   ```
3. Envio dos dados com as coordenadas obtidas:
   - **Endpoint:** `POST /pages/cadastros/alteraEmpresaEndereco.php`
   - **Payload:**
     ```json
     {
       "pais": "1",
       "empCidade": "5155",
       "empEndereco": "Rua Misushiro",
       "empBairro": "Parque 10 de Novembro",
       "empCEP": "69054-672",
       "empNumero": "154",
       "empLat": -3.0882142,
       "empLong": -60.0073281
     }
     ```

---

### 📊 Passo 2: Segmentação do Estabelecimento (`#stepDataEstablishment`)

Mapeamento comercial do ticket médio, canal de atração e estrutura física/humana.

#### 1. Campos e Controles:
| Campo | ID / Name | Tipo | Detalhes Técnicos |
| :--- | :--- | :--- | :--- |
| **Valor do Corte** | `#valor_corte` | `input[text]` | Máscara monetária `(999){+|1},99`. Converte `50,00` em `50.00` antes de enviar. |
| **Como Soube** | `#how_know` | `select` | Select2 com 44 canais de atração mapeados. |
| **Tamanho da Equipe** | `input[name="account_team_size"]` | `radio` | 4 botões estilizados (`.btn-check` + `.btn-outline-dashed`). Validação: `notEmpty` (*"Text input is required"*). |

#### 2. Catálogo de Origens ("Como Soube" - `#how_know`):
- **Canais Digitais:** `1` (Google), `2` (Facebook), `3` (Instagram), `4` (YouTube), `20` (Email), `68` (TikTok), `5` (Indicação de Amigo/Conhecido/Familiar)
- **Eventos e Imersões:** `47` (Barber Day Conference), `52` (Barber Week), `61` (Imersão Case B), `65` (Barbearia de Milhões), `75` (Experience 180 - Diogo Silva)
- **Influenciadores / Parceiros:**
  - `24`: Influencer - Seu Elias
  - `13`: Influencer - Mauricio Velozo
  - `9`: Influencer - Ayrton Alexander
  - `28`: Influencer - Brunno Barbearia 23
  - `12`: Influencer - Gilvan Silva
  - `8`: Influencer - Adri Barbeiro
  - `7`: Influencer - Barbalhada
  - `14`: Influencer - Pitana
  - `23`: Influencer - Laercio
  - `25`: Influencer - Geazi Barber
  - `26`: Influencer - Gustavo Novva
  - `35`: Influencer - Toledo Barber
  - `42`: Influencer - Taina Barber
  - `43`: Influencer - Leonardo Antonieli
  - `45`: Influencer - Bruno Rosa
  - `48`: Influencer - Luiz Gustavo Aguiar
  - `53`: Influencer - Danilo Moretti
  - `56`: Influencer - Matheus Castro
  - `58`: Influencer - Kauã Hausmann
  - `63`: Influencer - Zaparty
  - `64`: Influencer - David Júnior Barber
  - `67`: Parceiro - Vitor Correia
  - `69`: Parceiro - Emerson/O BARBEIRIN
  - `70`: Parceiro - Michel (Hunker Barbearia)
  - `73`: Parceiro - Félix Virgílio
  - `74`: Influencer - Sidney Castilho
  - `76`: Parceiro Marcus Turati
  - `77`: AS Cosméticos
  - `81`: Influencer - Jhony Navalha
  - `82`: Influencer - Papo de Barbeira/Luiza Lopes
  - `83`: Parceiro - André / Santo Visu
  - `6`: Influencer - Outros

#### 3. Opções de Porte da Equipe (`account_team_size`):
- `1`: 1 profissional (Autônomo/Individual)
- `2`: 2 a 5 profissionais
- `3`: 6 a 15 profissionais
- `4`: Mais de 15 profissionais

#### 4. Submissão da Etapa 2:
- **Endpoint:** `POST /pages/cadastros/alteraSegmentacaoEmpresa.php`
- **Payload:**
  ```json
  {
    "tipoestabelecimento": "",
    "numeroprofissionais": "1",
    "comosoube": "3",
    "obs": "",
    "valorcorte": "50.00"
  }
  ```

---

### ✂️ Passo 3: Catálogo Inicial de Serviços (`#stepServices`)

Permite cadastrar os serviços padrão ofertados aos clientes.

#### 1. Formulário de Inserção Rápida:
- **Descrição (`#servico_descricao`):** Campo texto para o nome do serviço.
- **Valor (`#servico_valor`):** Campo numérico formatado com máscara monetária.
- **Duração (`#servico_duracao`):** Dropdown com 20 opções de intervalos padronizados:
  - `15`, `30`, `45`, `60`, `75`, `90`, `105`, `120`, `135`, `150`, `165`, `180`, `195`, `210`, `225`, `240`, `255`, `270`, `285`, `300` minutos.
- **Botão Adicionar (`#btnAdicionarServico`):**
  - Dispara `POST ../pages/cadastros/insereServicosWizard.php`.
  - **Payload:**
    ```json
    {
      "serDescricao": "Corte Tradicional",
      "valor": "50.00",
      "serIntervalo": "30"
    }
    ```
  - Em caso de sucesso, limpa os campos, exibe notificação via Toastr e recarrega a tabela chamando `buscaServicos()`.

#### 2. Tabela de Listagem de Serviços (`#tbodyService`):
- Renderizada pela função `buscaServicos()` que consome `POST ../pages/cadastros/buscaServicosv2.php`.
- **Schema real retornado pelo backend (`buscaServicosv2.php`):**
  ```json
  {
    "data": [
      {
        "Ser_Codigo": "1339690",
        "Ser_Descricao": "Corte",
        "Ser_Intervalo_Padrao": "45",
        "Ser_Valor": "20,00",
        "Ser_Ponto": "0",
        "Ser_Usa_Ponto": "0",
        "PIt_Ponto": "",
        "Ser_Figura": "",
        "Ser_Duplo": "0",
        "Ser_Usa_App": "1",
        "Ser_Tem_Retorno": "",
        "Ser_Comissao": "",
        "Ser_Tip_Preco": "",
        "Ser_Observacao": "",
        "Ser_Msg_Retorno": "",
        "Ser_Dis_Apresentacao": "1",
        "Ser_Dis_Vlr_Apresentacao": "1",
        "Ser_Simultaneo": "",
        "TCa_Codigo": "",
        "TCa_Descricao": "",
        "Moeda": "R$ ",
        "Ser_Tem_Auxiliar": "",
        "Ser_Valor_Auxiliar": "",
        "Ser_Inss": "",
        "Ser_Pis": "",
        "Ser_Cofins": "",
        "Ser_Ir": "",
        "Ser_Iss": "",
        "Ser_Clss": "",
        "Ser_Exclusivo_Assinatura": "",
        "Ser_Custo": "",
        "AuxPadrao": "",
        "ComissaoAux": "",
        "SAu_Codigo": "",
        "AuxPadraoServico": "",
        "SauCodigoSerPadrao": ""
      }
    ]
  }
  ```
- **Campos Notáveis do Serviço:**
  - `Ser_Codigo`: Identificador primário do serviço.
  - `Ser_Intervalo_Padrao`: Duração em minutos no calendário de agendamento.
  - `Ser_Usa_App`: Flag de disponibilidade para agendamento online via aplicativo mobile e web.
  - `Ser_Exclusivo_Assinatura`: Flag que restringe o serviço para clientes com plano/assinatura recorrente.
  - `Ser_Comissao`: Percentual ou valor fixo de repasse ao profissional.
  - `Ser_Dis_Apresentacao` / `Ser_Dis_Vlr_Apresentacao`: Controla exibição pública de nome e preço.
- **Exclusão de Serviço (`removeServico`):**
  - Dispara `GET ../pages/cadastros/removeServicos.php?sercodigo={codigo}`.
  - Se retornar `"0"`, exibe mensagem de sucesso e atualiza a listagem.

#### 3. Regra de Transição para o Próximo Passo:
- Ao clicar em "Continuar":
  - Se a lista já contiver ao menos 1 serviço (`arrayServices.length > 0`), avança diretamente.
  - Se a lista estiver vazia, mas os campos do formulário estiverem preenchidos, insere automaticamente o serviço e avança.
  - Se a lista estiver vazia e os campos não estiverem preenchidos, bloqueia o avanço e exibe Toastr de erro: *"Por favor, adicione pelo menos 1 serviço."*

---

### 💈 Passo 4: Equipe de Profissionais (`#stepProfessionals`)

Cadastra os profissionais e barbeiros que realizarão os atendimentos na barbearia.

#### 1. Formulário de Inserção Rápida:
- **Nome (`#profissional_nome`):** Nome completo do colaborador.
- **Celular (`#profissional_celular`):** Celular com máscara telefônica `(99) 99999-9999`.
- **Botão Adicionar (`#btnAdicionarProfissional`):**
  - Dispara `POST ../pages/cadastros/insereProfissionaisWizard.php`.
  - **Payload:**
    ```json
    {
      "proNome": "Carlos Barbeiro",
      "proCelular": "(92) 99123-4567"
    }
    ```
  - Em caso de sucesso, limpa os campos de input, exibe notificação via Toastr e recarrega a tabela chamando `buscaProfissionais()`.

#### 2. Tabela de Listagem de Profissionais (`#tbodyProfissionais`):
- Consome `POST ../pages/cadastros/buscaProfissionais.php`.
- **Schema real retornado pelo backend (`buscaProfissionais.php`):**
  ```json
  {
    "profissionais": [
      {
        "Pes_Codigo": "29044142",
        "Pes_Nome": "Jonathas Cerqueira",
        "Pes_Apelido": "Jonathas",
        "Pes_Dat_Cadastro": "15/08/2026 08:18",
        "PAF_RG": "",
        "PAF_CPF": "",
        "PAF_Sexo": "",
        "PAF_Gestor": "1",
        "PAF_Dat_Nascimento": "",
        "PAF_Email": "aptus.fl@gmail.com",
        "PAF_Telefone": "",
        "PAF_Celular": "(92) 98520-9999",
        "PAF_Endereco": "",
        "PAF_Numero": "",
        "PAF_Complemento": "",
        "PAF_CEP": "",
        "PAF_Bairro": "",
        "PAF_Observacao": "",
        "PAF_Imagem": "",
        "PAF_Dis_Aplicativo": "1",
        "Cid_Codigo": "",
        "Cid_Nome": "",
        "Est_Codigo": "",
        "Est_Sigla": "",
        "Usu_Login": "E-mail",
        "Usu_Senha": "",
        "Usu_Codigo": "11084059",
        "Usu_Dat_Expiracao": "15/08/2027",
        "Usu_Tentativa": "0",
        "SituacaoUsuario": "",
        "Primeiro": "1",
        "EhCNPJ": "0",
        "Nota": "0.00",
        "PAF_Disp_Apresentacao": "",
        "PAF_DDI": "",
        "PAF_Connect_Recebedor": "",
        "PAF_Connect_Split": "",
        "PAF_Split_Fee": ""
      }
    ]
  }
  ```

#### 3. Atributos Críticos do Modelo de Profissional:
- `Pes_Codigo`: Identificador primário da entidade `Pessoa` no sistema legado.
- `PAF_Gestor`: Flag indicando privilégio administrativo/gerencial (`"1"` para proprietário/gestor, `"0"` para funcionário).
- `Primeiro`: Flag indicando que é o usuário titular criador do estabelecimento (`"1"`).
- `PAF_Dis_Aplicativo`: Flag booleana que controla se o profissional é listado para agendamento pelos clientes no aplicativo.
- `PAF_Connect_Recebedor`, `PAF_Connect_Split`, `PAF_Split_Fee`: Campos de split financeiro para divisão automática de pagamentos no gateway integrado (Pagar.me / Asaas / Stripe Connect).
- `Usu_Codigo` & `Usu_Dat_Expiracao`: Chave estrangeira para a tabela de usuários com data de expiração da assinatura do software.

#### 4. Regra de Segurança de Exclusão:
```javascript
var displayButtonRemove = 'display: none;';
if (data.profissionais.length > 1){
    displayButtonRemove = '';
}
```
> **Trava de Segurança:** O botão de remoção (`removeProfissional`) permanece com `style="display: none;"` enquanto houver apenas 1 profissional cadastrado na barbearia. Isso impede acidentes operacionais onde o proprietário ficaria sem nenhum colaborador cadastrado para receber agendamentos.

- **Exclusão de Profissional (`removeProfissional`):**
  - Dispara `GET ../pages/cadastros/removeProfissionais.php?pescodigo={codigo}`.
  - Se o servidor responder com `"0"`, exibe Toastr de confirmação e recarrega `buscaProfissionais()`.

---

## 4. Pipeline de Finalização do Assistente

Ao clicar no botão **"Finalizar"** (`ktStepper.btnSubmit`), a aplicação executa um pipeline de 4 etapas:

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuário (Navegador)
    participant Stepper as KTStepper (Front-end)
    participant CRM as /php/crm/updateOrg.php
    participant Widget as /pages/cadastros/buscaCodigoWidgetSite.php
    participant Pagina as /pages/cadastros/alteraPagina.php
    participant UserWizard as /php/atualizaUsuarioWizard.php
    participant Dashboard as /index.php

    User->>Stepper: Clica em "Finalizar"
    Stepper->>Stepper: Ativa data-kt-indicator="on" e disabled
    
    Stepper->>CRM: POST /php/crm/updateOrg.php
    CRM-->>Stepper: 200 OK

    Stepper->>Widget: POST /pages/cadastros/buscaCodigoWidgetSite.php (tipo=1, tipometodo=1) [Síncrono]
    Widget-->>Stepper: 200 OK (Código do Widget)

    Stepper->>Pagina: POST /pages/cadastros/alteraPagina.php [Síncrono]
    Pagina-->>Stepper: 200 OK

    Stepper->>UserWizard: POST /php/atualizaUsuarioWizard.php
    UserWizard-->>Stepper: { "result": [{ "erro": "0" }] }
    
    Stepper->>Dashboard: window.location.assign("/index.php")
```

---

## 5. Dicionário de Endpoints e Especificação de APIs

| # | Rota / URL | Método | Propósito / Função | Payload / Query Params | Formato de Retorno |
| :-: | :--- | :-: | :--- | :--- | :-: |
| **1** | `https://viacep.com.br/ws/{cep}/json/` | `GET` | Consulta dados de endereço por CEP | `cep` (URL param) | JSON (`logradouro`, `bairro`, `localidade`, `uf`) |
| **2** | `https://maps.googleapis.com/maps/api/geocode/json` | `GET` | Converte endereço em Latitude/Longitude | `address`, `key` | JSON (`results[0].geometry.location`) |
| **3** | `../pages/cadastros/buscaEstadoPais.php` | `POST` | Lista UFs de acordo com o país | `paicodigo` | JSON (`result`: array de `{ Est_Sigla, Est_Codigo, Est_Nome }`) |
| **4** | `../pages/cadastros/buscaCidadesCombo.php` | `POST` | Lista cidades da UF | `estCodigo` | JSON (`data`: array de `{ Cid_Codigo, Cid_Nome }`) |
| **5** | `/pages/cadastros/alteraEmpresaEndereco.php` | `POST` | Salva o endereço e localização | `pais`, `empCidade`, `empEndereco`, `empBairro`, `empCEP`, `empNumero`, `empLat`, `empLong` | JSON (`result`: array de `{ erro, resultado }`) |
| **6** | `/pages/cadastros/alteraSegmentacaoEmpresa.php` | `POST` | Grava porte, ticket e canal de origem | `tipoestabelecimento`, `numeroprofissionais`, `comosoube`, `obs`, `valorcorte` | JSON (`result`: array de `{ erro, resultado }`) |
| **7** | `../pages/cadastros/buscaServicosv2.php` | `POST` | Lista serviços cadastrados | *(nenhum)* | JSON (`data`: array de `34` atributos de serviço) |
| **8** | `../pages/cadastros/insereServicosWizard.php` | `POST` | Adiciona novo serviço | `serDescricao`, `valor`, `serIntervalo` | JSON (`insereServico`: array de `{ erro, resultado }`) |
| **9** | `../pages/cadastros/removeServicos.php` | `GET` | Exclui serviço | `sercodigo` | Texto / String (`"0"` em sucesso) |
| **10** | `../pages/cadastros/buscaProfissionais.php` | `POST` | Lista profissionais da barbearia | *(nenhum)* | JSON (`profissionais`: array de `37` atributos de profissional) |
| **11** | `../pages/cadastros/insereProfissionaisWizard.php` | `POST` | Adiciona novo profissional | `proNome`, `proCelular` | JSON (`insereProfissional`: array de `{ erro, resultado }`) |
| **12** | `../pages/cadastros/removeProfissionais.php` | `GET` | Exclui profissional | `pescodigo` | Texto / String (`"0"` em sucesso) |
| **13** | `/php/crm/updateOrg.php` | `POST` | Sincroniza organização no CRM | *(nenhum)* | JSON |
| **14** | `/pages/cadastros/buscaCodigoWidgetSite.php` | `POST` | Inicializa widget de agendamento online | `tipo: "1"`, `tipometodo: "1"` | HTML / Texto |
| **15** | `/pages/cadastros/alteraPagina.php` | `POST` | Registra estado de conclusão de etapa | *(nenhum)* | JSON |
| **16** | `/php/atualizaUsuarioWizard.php` | `POST` | Marca conclusão definitiva do Wizard | *(nenhum)* | JSON (`result`: array de `{ erro, resultado }`) |

---

## 6. Modelo de Entidades e Atributos Mapeados

Com base na navegação e nas respostas reais dos endpoints, o modelo relacional subjacente ao Wizard possui a seguinte estrutura de campos:

```
  ┌──────────────────────────────────────────────────────────┐
  │                    EMPRESA / ESTABELECIMENTO             │
  ├──────────────────────────────────────────────────────────┤
  │ - Emp_Codigo (PK)                                        │
  │ - Pai_Codigo (FK -> Pais)                                │
  │ - Cid_Codigo (FK -> Cidade)                              │
  │ - Emp_Endereco: string (Rua / Logradouro)                │
  │ - Emp_Bairro: string                                     │
  │ - Emp_Numero: string                                     │
  │ - Emp_CEP: string                                        │
  │ - Emp_Latitude: decimal(10,8)                            │
  │ - Emp_Longitude: decimal(11,8)                           │
  │ - Emp_Numero_Profissionais: enum (1, 2-5, 6-15, +15)     │
  │ - Emp_Valor_Corte: decimal(10,2)                         │
  │ - Emp_Como_Soube_Codigo: int                             │
  │ - Emp_Wizard_Concluido: boolean                          │
  └────────────────────────────┬─────────────────────────────┘
                               │ 1:N
           ┌───────────────────┴───────────────────┐
           ▼                                       ▼
  ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
  │            SERVIÇO              │   │      PESSOA / PROFISSIONAL      │
  ├─────────────────────────────────┤   ├─────────────────────────────────┤
  │ - Ser_Codigo (PK)               │   │ - Pes_Codigo (PK)               │
  │ - Emp_Codigo (FK)               │   │ - Emp_Codigo (FK)               │
  │ - Ser_Descricao: string         │   │ - Pes_Nome: string              │
  │ - Ser_Valor: decimal(10,2)      │   │ - Pes_Apelido: string           │
  │ - Ser_Intervalo_Padrao: int     │   │ - PAF_Celular: string           │
  │ - Ser_Comissao: decimal(5,2)    │   │ - PAF_Email: string             │
  │ - Ser_Usa_App: boolean          │   │ - PAF_Gestor: boolean (Admin)   │
  │ - Ser_Exclusivo_Assinatura: bool│   │ - PAF_Dis_Aplicativo: boolean   │
  │ - Ser_Ponto: int (Fidelidade)   │   │ - Primeiro: boolean (Dono/Tit.) │
  │ - Ser_Custo: decimal(10,2)      │   │ - PAF_Connect_Recebedor: string │
  │ - Tributos (ISS, PIS, COFINS)   │   │ - PAF_Connect_Split: string     │
  └─────────────────────────────────┘   │ - Usu_Codigo (FK -> Usuario)    │
                                        │ - Usu_Dat_Expiracao: datetime   │
                                        └─────────────────────────────────┘
```
