# Especificação Técnica: Aprofundamento do Módulo CanalClienteRepository

## Problem Statement

As páginas do **Canal do Cliente** (`FluxoAgendamento.tsx` e `MenuCliente.tsx`) contêm mais de 1.800 linhas de código acumulando responsabilidades misturadas de UI, chamadas diretas a rotinas RPC do Supabase (`get_services_by_customer_token`, `get_professionals_by_customer_token`, `get_available_slots_by_customer_token`, `create_appointment_by_customer_token`, `reschedule_appointment_by_customer_token`, `cancel_appointment_by_customer_token`), gestão manual de token no `localStorage`, filtragem de horários e tratamento disperso de erros de banco de dados. Isso torna as regras de agendamento difíceis de testar em isolamento e cria alta fragilidade a cada nova alteração de interface.

## Solution

Criar o módulo profundo **`CanalClienteRepository`** com uma interface concisa atrás da costura (*seam*) **`ICanalClienteAdapter`**. O repositório assumirá a validação do **Acesso Tokenizado do Cliente**, a gestão do token no `localStorage` (ocultado pelo adaptador Supabase), o catálogo de serviços e profissionais, a busca de horários disponíveis, a separação de agendamentos (ativos vs. histórico) e o disparo de exceções de domínio tipadas (`CanalClienteTokenError`, `AgendamentoConflitoError`, `AgendamentoRegraCancelamentoError`).

As telas React utilizarão o custom hook **`useCanalCliente`** sem sofrer **nenhuma alteração em seu layout visual, estilos CSS, componentes ou experiência do usuário**.

## User Stories

1. As a customer using the client channel, I want to access the scheduling flow via a tokenized link without typing a password, so that I can quickly book my appointment.
2. As a customer using the client channel, I want my access token to be saved seamlessly in my session, so that I do not get logged out when moving between pages.
3. As a customer using the client channel, I want to view active services categorized neatly, so that I can choose the exact haircut or beard service I need.
4. As a customer using the client channel, I want to choose my preferred barber or any available professional, so that I get the service from the professional I trust.
5. As a customer using the client channel, I want to view accurate available time slots in my timezone, so that I can select a time that fits my schedule.
6. As a customer using the client channel, I want clear and immediate feedback if a time slot becomes unavailable, so that I can pick another slot without confusion.
7. As a customer using the client channel, I want to view my active appointments separated from past or canceled ones, so that I can easily keep track of upcoming visits.
8. As a customer using the client channel, I want to reschedule an upcoming appointment to a new date and time, so that I can adapt to unexpected schedule changes.
9. As a customer using the customer channel, I want to cancel an upcoming appointment with an optional cancellation reason, so that the barbershop knows I will not attend.
10. As a developer, I want all token, catalog, and booking operations behind a single `ICanalClienteAdapter` interface, so that I can write lightning-fast unit tests using an in-memory adapter without connecting to the database.
11. As a developer, I want custom domain error classes (`CanalClienteTokenError`, `AgendamentoConflitoError`, `AgendamentoRegraCancelamentoError`), so that UI pages handle failures declaratively instead of parsing raw SQL error strings.
12. As a product designer, I want the visual layout, CSS classes, animations, and JSX structure of `FluxoAgendamento.tsx` and `MenuCliente.tsx` to remain 100% untouched, so that users experience zero disruption to the UI.

## Implementation Decisions

- **Módulo Único Profundo (`CanalClienteRepository`)**:
  - Centralizar todas as chamadas tokenizadas de catálogo, horários, perfil e agendamento em `src/modules/canal-cliente/CanalClienteRepository.ts`.
- **Encapsulamento de Persistência no Adaptador (`SupabaseCanalClienteAdapter`)**:
  - O `SupabaseCanalClienteAdapter` gerencia a leitura e escrita do `navalhado_customer_token` no `localStorage` do navegador de forma transparente.
- **Tipos de Domínio Unificados (`types.ts`)**:
  - Definir interfaces canônicas: `PerfilClienteCanal`, `ServicoCanal`, `ProfissionalCanal`, `AgendamentoCanal`, `InputCriarAgendamento`, `InputReagendarAgendamento`, `InputPromoverCadastroCliente` e `ICanalClienteAdapter`.
- **Erros de Domínio Tipados (`errors.ts`)**:
  - Mapear respostas de erro das RPCs do Supabase para exceções limpas: `CanalClienteTokenError`, `CanalClienteValidationError`, `AgendamentoConflitoError`, `AgendamentoRegraCancelamentoError`.
- **Custom Hook React (`useCanalCliente.ts`)**:
  - Prover o hook `useCanalCliente` que entrega uma instância memoizada do repositório configurada com o adaptador padrão de produção.
- **Preservação Restrita de UI/Layout**:
  - Nenhuma classe CSS, ícone HugeIcons, modal ou fluxo visual de `FluxoAgendamento.tsx` ou `MenuCliente.tsx` será modificado.

## Testing Decisions

- **Testes Unitários em Memória (`CanalClienteRepository.test.ts`)**:
  - Criar `InMemoryCanalClienteAdapter` implementando `ICanalClienteAdapter` com coleções locais (`Map` e `Array`).
  - Cobrir 100% dos cenários: resolução de token, filtragem por categorias, validação de inputs de data/horário, disparo de `AgendamentoConflitoError` em duplo agendamento no mesmo horário, e regra de impedimento de duplo cancelamento.
- **Verificação de Compilação e Build**:
  - Garantir execução limpa de `npm run build` sem avisos ou erros de compilação TypeScript.

## Out of Scope

- Qualquer modificação nas tabelas do Supabase Postgres ou criação/alteração de RPCs no servidor.
- Alterações visuais, redesign ou modificações nos componentes de UI das páginas do cliente.
- Refatoração do módulo de barbeiros ou módulo administrativo do gerente.

## Further Notes

- Especificação derivada da síntese do alinhamento via *grilling* e documento `implementation_plan.md`.
