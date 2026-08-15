# Mapeamento e Engenharia Reversa Estrutural: Módulo de Agenda (AppBarber)

Este documento apresenta a engenharia reversa completa, mapeamento de protocolos de rede, ciclo de vida da interface, arquitetura de componentes e catálogo exaustivo de endpoints do **Módulo de Agenda** (`#/agenda`) do sistema **AppBarber**.

---

## 1. Metadados e Arquitetura da Aplicação

- **URL Base:** `https://sistema.appbarber.com.br/index.php#/agenda`
- **WebService Central:** `https://ws.appbeleza.com.br/Service.php`
- **Título da Página:** `AppBarber | Agenda`
- **Padrão Arquitetural do Frontend:** Single Page Application (SPA) baseada em **AngularJS 1.x** com roteamento via **UI-Router** (`$stateProvider`), injeção dinâmica de módulos via **ocLazyLoad** e manipulação DOM baseada em **jQuery 3.x**.
- **Tema e Design System:** AdminLTE 2.x customizado sobre Bootstrap 3.x com fontes e temas dinâmicos.
- **Motor de Renderização da Agenda:** **FullCalendar 2.x** com extensão customizada para colunas de recursos (`resourceDay`), permitindo visualização simultânea de múltiplos profissionais lado a lado.
- **Bibliotecas Auxiliares:**
  - **Manipulação de Tempo/Fuso:** `Moment.js` + `moment-timezone` + `moment-locales` (pt-BR).
  - **Color Picker:** `iro.js` para seleção de cores hexadecimais em tags de agendamento.
  - **Menus de Contexto:** `jQuery.contextMenu` ancorado nas classes de status dos eventos (`.hasmenu`, `.hasmenu-confirmado`, `.hasmenu-realizado`, `.hasmenu-bloqueado`).
  - **Notificações:** `Toastr` + `SweetAlert` (`swal`).
  - **Inputs & Máscaras:** `Inputmask`, `VanillaMasker`, `jquery.maskMoney`, `jquery.timepicker`, `bootstrap-datepicker` (pt-BR), `bootstrap-multiselect`, `Select2`.

---

## 2. Mecanismo de Autenticação e Sessão para Scraping

Para replicar requisições ou criar robôs de extração/sincronização de dados, é necessário compreender as três camadas de identificação utilizadas pelo AppBarber:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            FLUXO DE AUTENTICAÇÃO DO CLIENTE                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   1. Cookie de Sessão PHP (PHPSESSID):                                           │
│      • Mantém o contexto de autenticação autenticado no servidor Apache/PHP.     │
│                                                                                  │
│   2. Identificador do Estabelecimento (APPBLZ_ID / SES_ID):                      │
│      • Hash MD5 único do estabelecimento (ex: c451c801a8f3268c83fdacc1fe7c2baf). │
│      • Enviado via Cookie `APPBLZ_ID` e parâmetro `id` nas chamadas ao Service.  │
│                                                                                  │
│   3. Cabeçalho de Requisição Assíncrona:                                         │
│      • `X-Requested-With: XMLHttpRequest` (obrigatório em vários endpoints).     │
│      • `Content-Type: application/x-www-form-urlencoded; charset=UTF-8`.         │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Cabeçalhos Padrão para Requisições:
```http
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Accept: application/json, text/javascript, */*; q=0.01
X-Requested-With: XMLHttpRequest
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Cookie: PHPSESSID=<SESSION_ID>; APPBLZ_ID=<ESTABELECIMENTO_HASH_MD5>;
```

---

## 3. Arquitetura de Estados e Ciclo de Vida da Agenda

O carregamento da tela é governado pelo controller AngularJS `agendaCtrl` registrado no módulo principal `appBeleza`.

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           INICIALIZAÇÃO DA TELA                        │
  │                          $state: 'agenda' (#/agenda)                   │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ 1. CARGA DE PARÂMETROS OPERACIONAIS                                    │
  │    • buscaParametro.php (parcodigo: 5 [slot], 43 [faixa], 141, 142)    │
  │    • timezone.php (Offset e fuso do estabelecimento)                   │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ 2. CARGA DE RECURSOS E METADADOS                                       │
  │    • buscaProfissionais.php (Gera as colunas 'resources' no calendário)│
  │    • buscaServicoSelectCombo.php (Lista de serviços)                   │
  │    • buscaClientes.php (Dicionário de clientes)                        │
  │    • buscaRodizio.php (Fila de atendimento de barbeiros)               │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ 3. BUSCA DOS AGENDAMENTOS DO DIA (buscaAgenda3.php)                    │
  │    • profissional[] = [ID1, ID2, ...]                                  │
  │    • tipo = 1 (Dia / resourceDay) | 2 (Mês) | 3 (Semana)               │
  │    • dia = DD/MM/YYYY                                                  │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ 4. RENDERIZAÇÃO NO FULLCALENDAR (eventRender & contextMenu)            │
  │    • Mapeamento de status (.hasmenu, .hasmenu-confirmado, etc.)        │
  │    • Amarração dos menus de clique direito e ações rápidas             │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Catálogo Exaustivo de Endpoints da Agenda

Todos os endpoints operam sobre a base `https://sistema.appbarber.com.br` (rotas internas) ou `https://ws.appbeleza.com.br` (web services).

### 4.1. Consulta da Grade de Agendamentos (`buscaAgenda3.php`)

- **Método:** `POST`
- **URL:** `/pages/actions/buscaAgenda3.php`
- **Descrição:** Retorna todos os agendamentos, bloqueios e encaixes do dia/período selecionado.
- **Payload (`x-www-form-urlencoded`):**
  - `profissional[]`: Array de IDs de profissionais (ou ID único selecionado).
  - `tipo`: `1` para dia (visão por colunas de profissionais), `2` para mês, `3` para semana.
  - `dia`: Data no formato `DD/MM/YYYY` (ex: `15/08/2026`).
- **Formato da Resposta:** Array JSON de objetos `AgendamentoEvent`.

```json
[
  {
    "id": "9482711",
    "title": "Carlos Silva - Corte Degradê",
    "start": "2026-08-15 09:00:00",
    "end": "2026-08-15 09:45:00",
    "resources": "29044142",
    "codStatus": "1",
    "Age_Confirmado": "1",
    "Encaixe": "0",
    "Age_Origem": "1",
    "codCliente": "459102",
    "PAF_CPF": "123.456.789-00",
    "celular": "(92) 99123-4567",
    "email": "carlos@email.com",
    "obs": "Cliente prefere tesoura no topo",
    "sercodigo": "1339690",
    "servico": "Corte Degradê",
    "valor": "45,00",
    "Com_Codigo": "781290",
    "CIt_Codigo": "119283",
    "CIt_Pag_Online": "0",
    "cupom": "",
    "rec": "0",
    "isAniversario": "0",
    "isPacote": "0",
    "assinatura": "0"
  }
]
```

---

### 4.2. Inserção de Novo Agendamento Padrão (`insereAgendamentov5.php`)

- **Método:** `POST`
- **URL:** `/pages/cadastros/insereAgendamentov5.php`
- **Descrição:** Cria um agendamento padrão de um ou múltiplos serviços para um cliente em um horário específico.
- **Payload:**
  - `item`: Código do serviço (ou lista separada por vírgula em serviços múltiplos).
  - `tipoitem`: Tipo do item (`1` = Serviço, `2` = Produto).
  - `profissional`: ID do profissional (`Pes_Codigo`).
  - `dataagendamento`: Data e hora inicial (`YYYY-MM-DD HH:mm:ss` ou `DD/MM/YYYY HH:mm`).
  - `duracao`: Tempo de duração total em minutos (ex: `45`).
  - `cliente`: ID do cliente (`Pes_Codigo`).
  - `cupom`: Cupom de desconto (opcional).
  - `numitens`: Quantidade de itens/serviços selecionados.
  - `ageorigem`: Origem do cadastro (`2` = Painel Web / Gestor).
  - `observacao`: Texto de observação interna.
  - `lembrete`: Tipo de lembrete (`0` = Nenhum, `1` = SMS, `2` = WhatsApp).
  - `tempolembrete`: Antecedência do lembrete em horas/minutos.
  - `sms`: `1` para disparar SMS, `0` caso contrário.
  - `whats`: `1` para preparar disparo via WhatsApp, `0` caso contrário.
- **Resposta JSON:**
```json
{
  "data": [
    {
      "erro": 0,
      "resultado": "Agendamento realizado com sucesso!"
    }
  ]
}
```

---

### 4.3. Inserção de Encaixe Rápido (`insereAgendamentoEncaixev3.php`)

- **Método:** `POST`
- **URL:** `/pages/cadastros/insereAgendamentoEncaixev3.php`
- **Descrição:** Registra um atendimento imediato (encaixe) que pode sobrepor a grade padrão sem validar intervalo estrito.
- **Payload:**
  - `item`: ID do serviço (`Ser_Codigo`).
  - `tipoitem`: `1` (Serviço).
  - `profissional`: ID do profissional.
  - `cliente`: ID do cliente ou texto avulso.
  - `dataagendamento`: Horário do encaixe.
  - `duracao`: Duração em minutos.
  - `observacao`: Motivo do encaixe.

---

### 4.4. Agendamento Recorrente (`insereAgendamentoRecorrentev2.php` e `cancelaAgendamentoRecorrente.php`)

- **Criação:**
  - **URL:** `/pages/cadastros/insereAgendamentoRecorrentev2.php`
  - **Campos:** `pescodigocliente`, `pescodigoprofissional`, `sercodigo`, `periodicidade` (`1`=Semanal, `2`=Quinzenal, `3`=Mensal), `dataini`, `datafim`, `horario`.
- **Cancelamento em Massa:**
  - **URL:** `/pages/cadastros/cancelaAgendamentoRecorrente.php`
  - **Campos:** `servico`, `profissional`, `cliente`, `dataini`.

---

### 4.5. Movimentação e Redimensionamento de Horário (`alteraAgendamento.php`)

- **Método:** `POST`
- **URL:** `/pages/cadastros/alteraAgendamento.php`
- **Descrição:** Executado quando um agendamento é arrastado (Drag & Drop), esticado (Resize) ou editado no modal.
- **Payload para Arraste (Troca de Data/Hora/Profissional):**
  - `tipoAlteraAgendamento`: `"4"`
  - `codItem`: ID do agendamento / item (`CIt_Codigo` ou `Age_Codigo`).
  - `dataAlteraAgendamento`: Nova data (`YYYY-MM-DD`).
  - `horaAlteraAgendamento`: Novo horário de início (`HH:mm:ss`).
  - `profissionalAlteraAgendamento`: ID do novo profissional (`Pes_Codigo`).
- **Payload para Redimensionamento de Duração (Resize):**
  - `tipoAlteraAgendamento`: `"8"`
  - `codItem`: ID do agendamento.
  - `dataAlteraAgendamento`: Data mantida.
  - `DuracaoAlteraAgendamento`: Nova duração em minutos (ex: `60`).
  - `profissionalAlteraAgendamento`: `""`.

---

### 4.6. Transição de Status e Cancelamento de Horários

#### Atualização de Status (`atualizaHorario.php`):
- **Método:** `POST`
- **URL:** `/pages/actions/atualizaHorario.php`
- **Modos (`tipo`):**
  - `tipo = 1` com `status = 5`: Marca o agendamento como **Em Atendimento / Comanda Aberta**.
  - `tipo = 2`: Atualiza texto de observação (`observacao`).
  - `tipo = 3`: Reassocia a outro cliente (`cliente`).
  - `tipo = 5`: Marca como **Confirmado pelo Estabelecimento**.
  - `tipo = 6`: Marca como **Ausente / Não Compareceu** (Gera flag de histórico de falta).
  - `tipo = 7`: Marca como **Finalizado / Atendido**.
  - `tipo = 8`: Reabre agendamento cancelado/finalizado.

#### Cancelamento Específico com Motivo (`cancelaHorario.php`):
- **Método:** `POST`
- **URL:** `/pages/actions/cancelaHorario.php`
- **Payload:**
  - `agendamento`: ID do agendamento (`Age_Codigo`).
  - `motivo`: Descrição opcional do motivo do cancelamento.

---

### 4.7. Bloqueio e Desbloqueio de Grade (`agendaHorarioBloqueado.php`)

- **Bloquear Período Único:**
  - **URL:** `/pages/actions/agendaHorarioBloqueado.php`
  - **Payload:** `profissional`, `diaini`, `diafim`, `horaini`, `horafim`, `observacao`.
- **Bloqueio Recorrente (ex: Horário de Almoço fixo, Folgas):**
  - **URL:** `/pages/cadastros/insereAgendamentoBloqueadoRecorrentev2.php`
  - **Payload:** `profissionalBloqueado`, `diaIniBloqueado`, `diaFimBloqueado`, `horaIniBloqueado`, `horaFimBloqueado`, `diasSemana[]`.
- **Desbloquear:**
  - **URL:** `/pages/actions/removeHorarioBloqueado.php`
  - **Payload:** `profissional`, `diaini`, `diafim`, `horaini`, `horafim`.

---

### 4.8. Fila de Atendimento e Rodízio de Barbeiros (`Rodízio`)

- **Consulta do Rodízio:**
  - **URL:** `/pages/cadastros/buscaRodizio.php` (`GET`)
- **Atualização da Fila:**
  - **URL:** `/pages/cadastros/atualizaRodizio.php` (`POST`)
  - **Payload:** `tcacodigo` (Categoria), `tipo` (`1`), `direcao` (`up`/`down`), `ordem`, `rodcodigo`, `procodigo`, `status` (`1`=Ativo na fila, `0`=Pausado).

---

### 4.9. Tags Coloridas nos Agendamentos

- **Consulta:** `/pages/cadastros/buscaAgendamentoTag.php?agecodigo=<ID>&id=<ESTABELECIMENTO_ID>` (`GET`)
- **Adição:** `/pages/cadastros/insereAgendamentoTag.php` (`POST`)
  - **Payload:** `agecodigo`, `cor` (Hex ex: `#FF5722`), `descricao`.
- **Remoção:** `/pages/cadastros/removeAgendamentoTag.php` (`POST`)
  - **Payload:** `codigo` (ID da tag).

---

### 4.10. Lista de Espera da Agenda

- **Inserção:** `/pages/cadastros/insereListaEspera.php` (`POST`)
  - **Payload:** `DataLista`, `ObsLista`, `pesCodigoCliente`, `usucodigo`, `servico`.
- **Alteração:** `/pages/cadastros/alteraListaEspera.php` (`POST`)
- **Remoção:** `/pages/cadastros/removeListaEspera.php` (`POST`)

---

### 4.11. WebService Centralizado (`https://ws.appbeleza.com.br/Service.php`)

Utilizado para funções transversais e consultas leves com cache:

| Método (`metodo`) | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `buscaProfissionais` | `id=<SES_ID>` | Lista completa de profissionais e permissões. |
| `buscaClientes_v3` | `id=<SES_ID>&tipo=2` | Catálogo de clientes cadastrados. |
| `buscaDataAtual` | `id=<SES_ID>` | Retorna a data/hora sincronizada do servidor. |
| `buscaTipoPagamento` | `id=<SES_ID>` | Bandeiras e meios de pagamento disponíveis no caixa. |
| `buscaParametro` | `id=<SES_ID>&parcodigo=<N>` | Consulta de parâmetro global específico. |
| `buscaMensagemUsuario` | `id=<SES_ID>&tipo=1` | Notificações e alertas internos do sistema. |
| `buscaAniversariante` | `id=<SES_ID>` | Lista de clientes aniversariantes do dia/mês. |
| `buscaSolicitacaoCadastro` | `id=<SES_ID>&tipo=5` | Solicitações pendentes feitas pelo app cliente. |

---

## 5. Dicionário de Status e Identidade Visual dos Agendamentos

No FullCalendar, cada bloco de agendamento recebe classes CSS de acordo com sua situação:

| Código (`codStatus`) | Flag Adicional | Classe CSS | Cor Típica | Descrição de Negócio |
| :---: | :---: | :---: | :---: | :--- |
| **`1`** | `Age_Confirmado = 0` | `.hasmenu` | Azul Escuro / Grafite | **Agendado** (Padrão, editável, aguardando confirmação) |
| **`1`** | `Age_Confirmado = 1` | `.hasmenu-confirmado` | Verde Claro | **Confirmado** (Cliente confirmou presença via link/whats) |
| **`1`** | `Encaixe = 1` | `.hasmenu-encaixe` | Marrom / Laranja | **Encaixe** (Horário inserido fora da grade regular) |
| **`2`** | — | `.hasmenu-realizado` | Verde Escuro | **Realizado** (Serviço executado, pronto para faturar) |
| **`4`** | — | `.hasmenu-bloqueado` | Vermelho / Cinza | **Bloqueado** (Horário indisponível / Folga / Almoço) |
| **`5`** | — | `.hasmenu-realizado` | Roxo / Azul | **Em Atendimento / Comanda Aberta** |
| **`6`** | — | — | Cinza Claro | **Cancelado / Ausente** |

---

## 6. Mapeamento de Modais e Gatilhos DOM

A página `/agenda` possui mais de **100 modais** embutidos no DOM. Os principais para scraping e automação de agendamento são:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAPA DE PRINCIPAIS MODAIS DA AGENDA                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • #infohorario-modal              Menu radial/ações ao clicar em horário ocupado       │
│ • #agendaHorario-modal            Formulário principal de agendamento de horário       │
│ • #insertServicoEncaixe-modal     Formulário de criação de encaixe rápido              │
│ • #cadastrarcliente-modal         Cadastro rápido de cliente durante agendamento       │
│ • #editarAgendamento-modal        Edição de serviço, barbeiro e horário                │
│ • #cancelarAgendamento-modal      Confirmação de cancelamento e motivo                 │
│ • #bloqueioHorario-modal          Bloqueio manual de intervalo ou dia inteiro          │
│ • #buscaHorariosDisponivel-modal  Verificador de slots livres por serviço/barbeiro     │
│ • #modalListaEspera-modal         Painel de gestão de lista de espera                  │
│ • #addtagagendamento-modal        Atribuição de tags coloridas (iro.js)                │
│ • #rodizio-modal                  Visualização e reordenação da fila de barbeiros      │
│ • #cadastrarlembrete-modal        Envio manual de lembrete SMS/WhatsApp                │
│ • #comanda-modal / #vercomanda    Abertura e finalização de comanda financeira         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Exemplos Práticos de Automação e Scraping

### 7.1. Script em Python (`requests`) para Extrair a Agenda do Dia

```python
import requests
import json
from datetime import datetime

BASE_URL = "https://sistema.appbarber.com.br"
WS_URL = "https://ws.appbeleza.com.br/Service.php"

# Configurações de Sessão
COOKIES = {
    "PHPSESSID": "SEU_PHPSESSID_AQUI",
    "APPBLZ_ID": "SEU_ESTABELECIMENTO_MD5_AQUI"
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
}

def obter_profissionais(ses_id: str):
    """Obtém a lista de barbeiros ativos do estabelecimento."""
    res = requests.get(
        f"{WS_URL}?metodo=buscaProfissionais&id={ses_id}",
        cookies=COOKIES,
        headers=HEADERS
    )
    return res.json().get("profissionais", [])

def extrair_agenda(data_str: str, lista_profissionais: list):
    """
    Extrai todos os agendamentos de uma data (formato DD/MM/YYYY).
    """
    ids_prof = [p["Pes_Codigo"] for p in lista_profissionais]
    
    payload = {
        "profissional[]": ids_prof,
        "tipo": 1,  # Visão diária detalhada
        "dia": data_str
    }
    
    res = requests.post(
        f"{BASE_URL}/pages/actions/buscaAgenda3.php",
        data=payload,
        cookies=COOKIES,
        headers=HEADERS
    )
    
    return res.json()

if __name__ == "__main__":
    hoje = datetime.now().strftime("%d/%m/%Y")
    print(f"[*] Consultando dados do AppBarber para {hoje}...")
    
    profs = obter_profissionais(COOKIES["APPBLZ_ID"])
    print(f"[+] {len(profs)} profissional(is) localizado(s).")
    
    agenda = extrair_agenda(hoje, profs)
    print(f"[+] {len(agenda)} agendamento(s) encontrado(s).\n")
    
    for item in agenda:
        print(f"ID: {item.get('id')} | Horário: {item.get('start')} -> {item.get('end')}")
        print(f"  Cliente: {item.get('title')}")
        print(f"  Status: {item.get('codStatus')} | Confirmado: {item.get('Age_Confirmado')}")
        print(f"  Valor: R$ {item.get('valor')} | Comanda: {item.get('Com_Codigo')}")
        print("-" * 50)
```

---

### 7.2. Script em TypeScript / Fetch para Inserir Novo Agendamento

```typescript
interface InserirAgendamentoParams {
  servicoId: string;
  profissionalId: string;
  clienteId: string;
  dataHora: string; // Ex: '2026-08-15 14:00:00'
  duracaoMinutos: number;
  observacao?: string;
}

async function criarAgendamento(params: InserirAgendamentoParams) {
  const form = new URLSearchParams();
  form.append('item', params.servicoId);
  form.append('tipoitem', '1');
  form.append('profissional', params.profissionalId);
  form.append('dataagendamento', params.dataHora);
  form.append('duracao', params.duracaoMinutos.toString());
  form.append('cliente', params.clienteId);
  form.append('numitens', '1');
  form.append('ageorigem', '2');
  form.append('observacao', params.observacao || '');
  form.append('lembrete', '0');
  form.append('tempolembrete', '0');
  form.append('sms', '0');
  form.append('whats', '0');

  const res = await fetch('https://sistema.appbarber.com.br/pages/cadastros/insereAgendamentov5.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: form.toString()
  });

  const data = await res.json();
  return data;
}
```

---

## 8. Considerações para Sincronização em Tempo Real

1. **Polling vs Webhooks:** O sistema web original do AppBarber executa polling via timer (`$scope.timerAgendaMS = 300000`, ou seja, a cada 5 minutos) chamando `$scope.buscaAgendaV3(1, data)`. Para integrações com sincronização mais rápida, pode-se reduzir o intervalo para 30 a 60 segundos respeitando limites de requisições.
2. **Atualização Otimista no DOM:** Ao arrastar ou alterar um agendamento na interface, o sistema move visualmente o evento no FullCalendar e envia a requisição AJAX em segundo plano; se a requisição retornar erro (`erro == 1`), o sistema exibe um alerta (`toastr.error`) e força uma releitura completa chamando `isAgendamentoAntigo(2)`.
3. **Tratamento de Timezone:** O sistema consulta `/php/timezone.php` na inicialização para garantir que agendamentos criados em fusos horários distintos (ex: Manaus UTC-4 vs Brasília UTC-3) não sofram deslocamento nos horários dos slots de atendimento.
