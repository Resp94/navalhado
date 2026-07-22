# Especificação Técnica: Alinhamento e Refinamento do Módulo ClienteRepository

## Problem Statement

Após a extração inicial do módulo `ClienteRepository` e do hook `useClientes`, a revisão de código em dois eixos (Standards e Spec) identificou inconsistências de nomenclatura de domínio (mistura de Inglês `Customer` e Português `Cliente`), vazamento de códigos de erro brutos do SQL (ex: `'23503'`) para a camada de React Hook, ausência de tratamento de erro no histórico de agendamentos do adaptador Supabase, e acoplamento de funções de utilidade de UI dentro do repositório de domínio.

## Solution

Refatorar e alinhar o módulo de clientes para garantir conformidade estrita com o vocabulário do `CONTEXT.md` (*Cliente Provisório*, *Cliente Completo*, *ClienteRepository*), converter exceções de banco em exceções de domínio tipadas (`ClienteValidationError`, `ClienteConstraintError`), isolar lógica de filtro de UI no hook `useClientes`, unificar assinaturas de métodos e garantir tratamento de erros em 100% das chamadas do adaptador Supabase.

## User Stories

1. Como desenvolvedor, quero que todos os tipos e interfaces do repositório usem a nomenclatura canônica do domínio em Português (`Cliente`, `ClienteInputData`, `HistoricoVisitasCliente`), para manter a clareza e evitar confusão entre termos em inglês e português.
2. Como desenvolvedor, quero que o `ClienteRepository` converta erros de violação de integridade do banco de dados (ex: exclusão de cliente com agendamentos) em exceções de domínio tipadas (`ClienteConstraintError`), para que a UI não precise inspecionar códigos de erro brutos do SQL (`23503`).
3. Como gerente da barbearia, quero que a listagem e visualização de detalhes falhem graciosamente com mensagens amigáveis em português quando ocorrer um erro na consulta ao banco de dados.
4. Como desenvolvedor, quero que a interface pública do `ClienteRepository` contenha apenas responsabilidades de persistência e regras de domínio pura (`listByTenant`, `saveCustomer`, `deleteCustomer`, `getHistoricoVisitas`), movendo cálculos e filtros temporários de UI para o hook `useClientes`.
5. Como desenvolvedor, quero que o método `fetchAppointmentHistory` no `SupabaseClienteAdapter` trate adequadamente erros lançados pela consulta Supabase, garantindo estabilidade no carregamento do histórico.

## Implementation Decisions

- **Unificação do Domínio (`types.ts`)**:
  - Renomear a interface principal de `Customer` para `Cliente` (mantendo propriedades `cadastro_completo`, `token_acesso`, `tenant_id`).
  - Definir o tipo `StatusFiltroCliente = 'todos' | 'completos' | 'provisorios'` como um tipo forte exportado do módulo.
- **Tratamento de Exceções de Domínio (`ClienteRepository.ts`)**:
  - Criar `ClienteConstraintError` para capturar exceções de chave estrangeira/exclusão violada no banco e traduzir em mensagem legível de domínio.
  - Garantir que o `ClienteRepository` faça a validação de presença e formato de dados obrigatórios usando `ClienteValidationError`.
- **Simplificação e Limpeza da Interface do Repositório**:
  - Expor no `ClienteRepository`: `listByTenant(tenantId: string)`, `saveCustomer(tenantId: string, data: ClienteInputData)`, `deleteCustomer(tenantId: string, customerId: string)` e `getHistoricoVisitas(customerId: string)`.
  - Mover a lógica pura de filtragem de texto e cálculo de totais da carteira para funções auxiliares no `useClientes.ts`.
- **Refinamento do Adaptador Supabase (`SupabaseClienteAdapter.ts`)**:
  - Garantir a checagem explicita `if (error) throw error;` no método `fetchAppointmentHistory`.
  - Eliminar duplicações de código no mapeamento de inserção e atualização de clientes.

## Testing Decisions

- Assegurar que os testes de unidade em `ClienteRepository.test.ts` utilizem `InMemoryClienteAdapter` para validar a ordenação, a promoção de cliente provisório para completo, e o lançamento de `ClienteValidationError` e `ClienteConstraintError`.
- Manter 100% de passagem nos testes de integração de componentes React em `src/pages/gerente/__tests__/Clientes.test.tsx`.

## Out of Scope

- Alterações na estrutura de tabelas do banco de dados Supabase ou migrações SQL.
- Refatoração de outras páginas do painel de gerente além do módulo de clientes.

## Further Notes

- Esta especificação visa sanar diretamente os 6 achados de Standards e 6 achados de Spec levantados no `/code-review`.
