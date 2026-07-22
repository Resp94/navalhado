# Especificação de Recursos: Aprofundamento do Módulo de Gerenciamento de Clientes (`ClienteRepository`)

## Problem Statement

Atualmente, o gerenciamento de clientes no painel do gerente reside num único arquivo monolítico de mais de 1.200 linhas (`Clientes.tsx` com 43KB). Como resultado, a página mistura consultas diretas ao banco de dados do Supabase, geração de tokens de acesso para **Cliente Provisório**, regras de validação de formulário, transição para **Cliente Completo**, busca de histórico de visitas e modais visuais do React.

Essa arquitetura rasa provoca atritos significativos:
- Dificuldade em testar regras de negócio cruciais de clientes sem renderizar a árvore inteira de componentes React e sem criar mocks complexos da SDK do Supabase.
- Baixa localidade: qualquer mudança na tabela do banco de dados ou na regra de promoção de cadastro exige navegar por centenas de linhas de código de interface visual.

## Solution

Criar um módulo profundo de domínio chamado `ClienteRepository` em `src/modules/clientes/` que centralize todo o ciclo de vida e operações de dados de clientes por tenant. O repositório oculta a persistência do Supabase por trás de uma única costura (*seam*) bem definida (`IClienteAdapter`), permitindo que a interface da página do gerente se torne uma camada de exibição pura, concisa e desacoplada.

---

## User Stories

1. Como gerente da barbearia, quero visualizar a lista completa de clientes cadastrados, para que eu possa acompanhar todos os meus clientes em um só lugar.
2. Como gerente da barbearia, quero filtrar a lista de clientes por nome, telefone ou e-mail, para que eu possa encontrar rapidamente o cadastro de uma pessoa específica.
3. Como gerente da barbearia, quero filtrar clientes por status de cadastro (todos, apenas **Cliente Completo** ou apenas **Cliente Provisório**), para identificar quais clientes ainda precisam completar seus dados.
4. Como gerente da barbearia, quero visualizar indicadores no topo da tela com a contagem total de clientes, cadastros completos e cadastros provisórios, para acompanhar a saúde da minha base de clientes.
5. Como gerente da barbearia, quero cadastrar manualmente um novo cliente informando nome, telefone, e-mail e observações, para registrar clientes que chegam presencialmente na barbearia.
6. Como gerente da barbearia, quero editar os dados de um cliente existente, para manter suas informações de contato e notas sempre atualizadas.
7. Como gerente da barbearia, quero que ao salvar ou editar um **Cliente Provisório**, o sistema automaticamente o promova para **Cliente Completo**, garantindo que seus dados foram validados pelo gerente.
8. Como gerente da barbearia, quero excluir o cadastro de um cliente que não frequenta mais a barbearia, para manter minha base de dados limpa.
9. Como gerente da barbearia, quero abrir uma gaveta lateral (*slide-over drawer*) de detalhes do cliente selecionado, para visualizar suas informações completas e o histórico de agendamentos passados e futuros.
10. Como gerente da barbearia, quero ver o histórico de visitas do cliente detalhando a data, o horário, o serviço realizado, o barbeiro responsável e o status do pagamento, para entender a frequência do cliente na barbearia.
11. Como desenvolvedor, quero que as operações de clientes fiquem isoladas num repositório desacoplado do React, para que a lógica de negócio possa ser testada usando adaptadores em memória sem dependência de conexões de rede.
12. Como desenvolvedor, quero que o repositório lance exceções de domínio tipadas quando dados obrigatórios estiverem ausentes, para que a UI receba mensagens claras de erro sem vazar erros genéricos de SQL.

---

## Implementation Decisions

### 1. Módulo Profundo & Estrutura de Arquivos
- O novo módulo residirá na pasta `src/modules/clientes/`.
- `ClienteRepository` exporá métodos limpos:
  - `listByTenant(tenantId: string)`
  - `saveCustomer(data: CustomerInputData)`
  - `deleteCustomer(customerId: string)`
  - `getHistoricoVisitas(customerId: string)`
  - `generateAccessToken()`

### 2. Padrão de Costura (*Seam*) & Injeção de Adaptador
- Definição do contrato `IClienteAdapter` para abstrair todas as chamadas de banco de dados.
- Implementação do adaptador padrão de produção `SupabaseClienteAdapter`.
- Implementação do adaptador para ambiente de testes `InMemoryClienteAdapter`.

### 3. Integração com a UI via Custom Hook
- Criação de `useClientes` para consumir a fábrica do repositório, gerenciando o estado de carregamento (`loading`), exibição de toasts de notificação (`useToast`) e chamadas de mutação.
- Redução da página `Clientes.tsx` de 1.270 linhas para aproximadamente 250-300 linhas de JSX declarativo.

---

## Testing Decisions

### 1. Superfície de Teste Única (*The Interface is the Test Surface*)
- Os testes automatizados interagirão exclusivamente com a interface pública do `ClienteRepository`.
- Não serão testados detalhes de implementação interna ou estados privados de UI React.

### 2. Estratégia de Teste com Adaptador Fake
- Os testes unitários e de integração de módulo utilizarão o `InMemoryClienteAdapter`.
- Isso garante execução instantânea, sem necessidade de banco Supabase rodando ou requisições HTTP reais.

---

## Out of Scope

- Alterações nas tabelas do banco de dados do Supabase (a estrutura de tabelas atual `customers` e `appointments` será mantida).
- Refatoração dos módulos de agendamento do barbeiro ou tela de atendimento (ficam para próximas etapas de aprofundamento).

---

## Further Notes

- A costura principal deste recurso é a interface `IClienteAdapter`. Toda a dependência de dados passa por essa única costura.
