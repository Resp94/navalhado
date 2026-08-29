## Problem Statement

A mensageria do Navalhado concentra webhook, primeiro contato, welcome de balcão, confirmações, reagendamentos, cancelamentos, lembretes, retornos, envio manual, idempotência e integração UAZAPI em uma única Edge Function. Essa concentração tornou os contratos entre banco, triggers, frontend e provider difíceis de verificar e permitiu que fluxos diferentes falhassem por motivos diferentes.

O primeiro contato está efetivamente quebrado no ambiente atual: a Edge Function chama o RPC de cliente com o parâmetro `p_push_name`, enquanto a função PostgreSQL publicada aceita `p_name`. O banco registra duas tentativas falhas de `first_contact` com `customer lookup failed`. Os testes existentes reproduzem o contrato antigo e, portanto, não detectam a divergência real.

O welcome de balcão depende de uma chamada HTTP disparada por trigger após o cadastro. Essa chamada não possui outbox transacional nem reprocessamento durável. Uma indisponibilidade da Edge Function, um timeout, um segredo inválido ou uma falha temporária do provedor pode fazer o cadastro persistir sem que o welcome seja enviado ou reprogramado.

O retorno possui uma cadeia de cron, RPC e Edge Function, mas o banco atual não contém atendimentos concluídos para validar o disparo. Além disso, os tokens oferecidos pela interface de serviços (`{cliente}`, `{servico}`, `{dias}`, `{link}`) não correspondem aos tokens que o backend de retorno substitui, o que pode produzir mensagens personalizadas com placeholders visíveis.

Ao mesmo tempo, confirmações, reagendamentos e lembretes possuem envios bem-sucedidos registrados e devem continuar funcionando. A refatoração precisa corrigir os contratos quebrados sem alterar as regras operacionais já protegidas pelo snapshot: agenda, timezone do tenant, slots, encaixes, comandas, notificações internas, RLS e funcionamento desktop/mobile.

## Solution

Corrigir primeiro os contratos de dados e entrega dos três fluxos problemáticos, criar testes de caracterização para os fluxos que já funcionam e então extrair a mensageria em módulos com responsabilidades profundas e interfaces explícitas.

O gateway atual permanecerá como uma fachada de compatibilidade durante a transição. Atrás dele haverá um único seam principal de despacho de mensagens, responsável por receber um evento normalizado, aplicar idempotência, renderizar o template, executar o adapter do provider e devolver um resultado observável. Regras de negócio de primeiro contato, welcome, appointment, lembrete e retorno serão separadas em handlers próprios, mas utilizarão o mesmo despacho.

Eventos originados por triggers de banco deixarão de depender exclusivamente de `net.http_post` fire-and-forget. O evento será persistido transacionalmente e processado por worker com lease, retry, backoff, idempotência e registro de erro. A entrega continuará passando exclusivamente pelo backend; credenciais e tokens da UAZAPI nunca serão expostos ao frontend.

O vocabulário de templates será unificado. Tokens legados serão aceitos durante a migração para preservar mensagens existentes, mas novas mensagens deverão usar um conjunto canônico e nunca poderão ser enviadas com placeholders não resolvidos.

O primeiro contato continuará sujeito à regra de no máximo uma mensagem diária por cliente e tenant, com link automático conforme o comportamento atual. O welcome continuará exclusivo para clientes cadastrados no balcão. O retorno continuará respeitando período do serviço, timezone, idempotência e supressão quando houver agendamento futuro, salvo decisão de produto documentada antes de alterar essas regras.

## User Stories

1. As a gerente, I want a customer who sends a first WhatsApp message to be found or created automatically, so that I do not need to register the customer manually.
2. As a gerente, I want the customer's WhatsApp display name to be preserved during first contact, so that the record is not created with an unintended generic name.
3. As a customer, I want to receive the first-contact message after my first eligible message of the day, so that I can access the barbershop's self-service channel.
4. As a customer, I want repeated messages on the same day to respect the daily sending rule, so that I do not receive duplicated promotional or access messages.
5. As an operator, I want a duplicated UAZAPI webhook event to be ignored safely, so that provider retries do not create duplicate customers or messages.
6. As an operator, I want a temporary customer lookup failure to be retried or recorded for reprocessing, so that an intermittent database or network error does not silently lose the first contact.
7. As a manager, I want a customer created at the counter with a valid phone number to receive the balcão welcome, so that the customer knows how to access the service channel.
8. As a manager, I want online, agenda, import and customer-channel registrations not to receive the balcão welcome, so that each onboarding origin keeps its own communication rule.
9. As an operator, I want a balcão welcome to be sent at most once, so that a reprocessed database event does not annoy the customer.
10. As an operator, I want a failed welcome delivery to remain pending for retry, so that a transient provider outage does not require manual database repair.
11. As an operator, I want `welcome_sent_at` to be updated only after confirmed provider acceptance, so that the database reflects actual delivery processing.
12. As a manager, I want the return reminder to be calculated from the configured service return period, so that each service has an appropriate follow-up interval.
13. As a customer, I want a return reminder when I become eligible, so that I remember to schedule my next visit.
14. As a manager, I want a future confirmed or pending appointment to suppress an unnecessary return reminder, so that customers with an upcoming booking are not contacted redundantly.
15. As an operator, I want one return reminder per return cycle, so that the daily job cannot repeatedly send the same reminder.
16. As a manager, I want custom return templates saved in the service screen to render correctly in WhatsApp, so that the message the team configured is the message the customer receives.
17. As a manager, I want an invalid or unknown template token to be rejected or reported before sending, so that customers never see raw placeholders.
18. As a customer, I want confirmation, rescheduling and cancellation messages to continue using the self-service link, so that I can manage my appointment from WhatsApp.
19. As a professional, I want appointment-created, rescheduled and canceled notifications to continue arriving independently of the customer's message, so that the team can operate the schedule.
20. As a customer, I want appointment reminders to respect the configured reminder window, so that I receive useful information without duplicate reminders.
21. As a manager, I want the manual test-message action to use the same payload contract as the backend, so that template testing from the WhatsApp screen works reliably.
22. As an operator, I want provider failures to expose status, retry count and event type without exposing secrets or full phone numbers, so that failures can be diagnosed safely.
23. As an operator, I want every message event to include tenant-scoped idempotency, so that retries cannot cross tenant boundaries or duplicate deliveries.
24. As a developer, I want UAZAPI access isolated behind an adapter, so that business handlers are not coupled to provider-specific HTTP details.
25. As a developer, I want the current gateway endpoints to remain compatible during migration, so that database triggers and existing callers do not fail during module extraction.
26. As a developer, I want database-triggered events to be durable before dispatch, so that an Edge Function timeout does not erase an operational event.
27. As a developer, I want migration history and live function definitions reconciled before schema changes, so that an already-applied migration is not accidentally replayed under a different filename.
28. As a security reviewer, I want message dispatch functions to enforce tenant, role and trigger-secret boundaries, so that a caller cannot send messages for another tenant.
29. As a security reviewer, I want SECURITY DEFINER functions to have explicit grants and a fixed search path, so that privileged database execution cannot be abused.
30. As an operator, I want the existing agenda, appointment, comanda, timezone and RLS behavior preserved, so that messaging improvements do not create operational regressions.

## Implementation Decisions

- The first implementation step is a contract correction, not a broad refactor: the first-contact caller must use the live RPC parameter `p_name`, and the RPC contract must be covered by a database or HTTP-level contract test.
- The first-contact handler remains responsible for customer lookup/creation, daily eligibility and first-contact event creation. Delivery is delegated to the shared message dispatcher.
- First-contact delivery uses the same deterministic idempotency key for inbound event deduplication and provider tracking. Database reservation and provider dispatch must be safe when the handler is retried after provider acceptance.
- The daily first-contact rule remains tenant-scoped and timezone-aware. The refactor must not reset or reinterpret `last_first_contact_at` for existing records.
- Welcome eligibility is enforced twice: the database trigger may enqueue only `balcao` inserts, and the handler must revalidate the customer's tenant, phone and `registration_origin` before dispatch.
- The welcome trigger must persist an event in the same transaction as the customer insert. A direct HTTP call from a database trigger is not the durable delivery mechanism.
- Welcome processing uses a lease and bounded retry. A temporary failure returns the event to a retryable state; a permanent failure remains inspectable with an error and does not set `welcome_sent_at`.
- The existing `whatsapp_message_idempotency` ledger remains the source for deduplication during the migration. A separate outbox is introduced only for payload and scheduling data that the current ledger cannot represent safely.
- Outbox writes are tenant-scoped and unique by `(tenant_id, idempotency_key)`. The outbox has explicit queued, processing, succeeded and failed states, an attempt count, next-available time, lease time and sanitized error information.
- The return flow initially preserves the current domain rule: latest completed appointment per customer, service-specific `return_period_days`, tenant timezone, no future confirmed/pending appointment, and one idempotent dispatch. The choice between appointment start and completion time must be confirmed before changing the calculation.
- Return cycles become a first-class persisted concept only if the product confirms that service changes, multiple completed services and future appointment suppression require durable cycle history. If introduced, each cycle references its tenant, customer, source appointment and service and has a unique dispatch identity.
- The canonical template vocabulary is `{cliente}`, `{servico}`, `{dias}`, `{barbearia}`, `{profissional}`, `{data}`, `{horario}` and `{link}`. Legacy return aliases remain readable during migration and are normalized before rendering.
- Rendering fails closed when a required variable is unavailable or an unresolved token remains. The system must record a render failure instead of sending malformed customer-facing text.
- The automatic link behavior remains unchanged: templates that omit `{link}` may receive the link according to the current first-message-of-day policy; templates that include `{link}` interpolate it at the canonical rendering seam.
- Confirmation, rescheduling, cancellation, professional notification and appointment reminder handlers are characterized before extraction and migrated one capability at a time. Their current event names and idempotency semantics remain compatible.
- The manual-send API accepts the canonical backend contract of tenant, recipient number and text. The frontend caller is adapted to that contract without adding a second send endpoint.
- The provider adapter owns UAZAPI authentication headers, endpoint paths, provider retry classification, explicit request timeout, `track_id`, response normalization and provider error mapping. Handlers do not construct provider HTTP requests.
- The shared dispatcher owns tenant/instance resolution, template rendering, idempotency reservation/finalization, provider invocation and structured observability. It does not decide whether a customer is eligible for a return or welcome.
- The gateway remains a compatibility facade until all existing database triggers, cron jobs, frontend callers and tests use the shared modules. No old route is removed in the first delivery.
- Database-triggered appointment events continue to originate from the existing appointment trigger. The refactor changes the delivery seam, not the agenda state machine, appointment statuses, fitting rules, comanda rules or notification behavior.
- The current provider and Edge Function secrets remain backend-only. `verify_jwt` behavior is not changed as part of the messaging refactor; custom authentication and trigger-secret validation are preserved until a dedicated authentication change is approved.
- Logs include correlation ID, tenant ID, event type, aggregate ID, attempt, status, duration and provider status. Logs exclude access tokens, instance tokens, JWTs, complete phone numbers and full message content.
- All privileged functions use an explicit search path and minimum grants. The existing Supabase advisor findings for publicly executable SECURITY DEFINER functions are tracked as a security-hardening workstream and are not silently changed as part of the first-contact fix.
- Migration filenames already applied remotely are not renamed or replayed. The live migration ledger and function definitions are reconciled before creating new additive migrations.
- The implementation uses deep modules and narrow seams: business handlers expose domain-level inputs, the dispatcher exposes one delivery contract, and the provider adapter hides UAZAPI details. Pass-through wrappers that merely rename fields are not accepted as the final architecture.

## Testing Decisions

- Tests validate externally observable behavior and contracts, not private helper layout, exact internal loops or framework implementation details.
- The first-contact contract test must assert the exact RPC argument name `p_name`, customer creation/reuse, push-name preservation, tenant isolation, duplicate webhook suppression and the daily sending rule.
- First-contact failure tests cover RPC failure, provider 429, provider 5xx, provider timeout and the case where provider acceptance is followed by handler interruption.
- Welcome tests cover balcão eligibility, non-balcão rejection, missing phone, disconnected instance, duplicate customer event, provider failure, retry lease, eventual success and the exact update of `welcome_sent_at`.
- Return tests create completed appointments and services in isolated fixtures. They cover due and not-due periods, tenant timezone boundaries, future confirmed/pending suppression, a new completed appointment starting a new cycle, duplicate cron execution and fully rendered custom templates.
- Template tests cover canonical tokens, legacy aliases, missing variables and unresolved-token rejection. A template written by the service-management UI must be rendered by the Edge Function without manual token translation.
- Appointment tests preserve existing behavior for customer and professional confirmation, rescheduling, cancellation, reminder windows, link insertion, opt-out/settings flags and idempotency.
- Provider tests cover request headers, endpoint/body contract, `track_id`, timeout, retryable status classification, permanent errors and sanitized error output using a fake provider seam.
- Manual-send tests cover the canonical request payload, authentication, tenant authorization, invalid phone/text rejection and the frontend-to-function contract.
- Database tests cover trigger event creation, tenant-scoped uniqueness, outbox lease/concurrency, RLS, grants, fixed search path, appointment-trigger preservation and no duplicate dispatch under concurrent workers.
- Existing frontend tests for WhatsApp templates and the WhatsApp management screen remain required. Existing tests for Agenda, Comandas, services, notifications and appointment scheduling remain required to protect the snapshot baseline.
- The test order is: focused failing regression test, minimal correction, focused pass, integration contract tests, full frontend suite, Edge Function suite, SQL tests, build and post-change Supabase advisor review.
- A live smoke test is required only after implementation approval and deployment authorization. This specification stage performs no live message send, migration application or deploy.

## Out of Scope

- Publishing this specification to GitHub, an issue tracker or any external system.
- Applying database migrations, changing live data, deploying Edge Functions or sending real WhatsApp messages during specification review.
- Replacing UAZAPI with another provider.
- Building a conversational WhatsApp bot, natural-language appointment booking or AI intent recognition.
- Changing the product's appointment, fitting, professional schedule, tenant business-hours, timezone, comanda or payment rules.
- Changing the meaning of `registration_origin` or automatically migrating historical customer origins.
- Automatically sending welcome messages for online, agenda, import, customer-channel or WhatsApp-origin records.
- Changing the daily first-contact policy without a separate product decision.
- Changing the return date basis from appointment start to checkout/completion without a separately approved business rule.
- Redesigning WhatsApp screens, template editor UX or the complete notification history UI.
- Removing the compatibility gateway before all consumers and database triggers have been migrated and verified.
- Deleting the existing idempotency ledger, historical message records, triggers or cron jobs during the first refactor phase.
- Broadly resolving all Supabase advisor findings unrelated to the messaging contracts.

## Further Notes

- The live database currently has one WhatsApp instance in connected state, no `balcao` customers, no `whatsapp_bot` customers and no completed appointments. This limits live reproduction of welcome and return and makes fixture-based tests essential.
- The live database has successful persisted deliveries for appointment creation, professional appointment creation, rescheduling and reminders. These records are the baseline for regression protection.
- The live migration ledger uses timestamps and names that do not map one-to-one to local migration filenames. Reconciliation is a prerequisite for any schema work.
- The existing unified log stream was available, but filtering the relevant period did not return matching first-contact or welcome messages. Operational observability must be improved before relying on logs as the only incident evidence.
- The Supabase security advisor reports that `find_or_create_whatsapp_customer` is a publicly executable SECURITY DEFINER function. Its intended caller and grants must be reviewed before the first-contact flow is exposed as a durable public integration.
- The implementation should be delivered in independently usable phases: first-contact contract fix, template contract normalization, welcome durability, return validation, shared-module extraction, observability/security hardening and legacy cleanup.
- Each phase must preserve a single delivery path per event. Dual-writing or dual-sending is not permitted unless the experiment is explicitly non-delivery and has a deterministic comparison strategy.
- Rollback is version-based for Edge Functions and additive for the database. New workers can be paused while the compatibility gateway remains available; historical idempotency records must not be deleted during rollback.
- This document is stored locally at `specs/021-refatoracao-mensageria-edge-functions/spec.md` as requested. It is not published to GitHub or an issue tracker.
