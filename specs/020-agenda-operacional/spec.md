## Problem Statement

O fluxo atual de agenda mistura regras de expediente do tenant, escala individual do profissional e regras especiais de encaixe. Como consequência, alterações feitas em Configurações podem não refletir imediatamente na grade, nos bloqueios ou nos controles de profissionais; encaixes podem ser rejeitados fora do expediente ou quando o profissional não está escalado; e a visualização desktop/mobile pode representar o mesmo atendimento de formas diferentes.

Também existem dois riscos operacionais relacionados. O primeiro é a origem da comanda: o sistema já possui o relacionamento entre comanda e atendimento, mas o enriquecimento precisa preservar corretamente a diferença entre encaixe, agendamento normal e comanda de balcão. O segundo é o no-show: o status já existe no domínio, porém é necessário permitir seu uso somente no momento correto, exibir o resultado na agenda e impedir que uma comanda vinculada continue gerando movimento financeiro.

O comportamento esperado é especialmente importante para a operação de barbearia: um encaixe é uma inclusão operacional flexível. Ele pode ser atribuído manualmente a qualquer profissional ativo, independentemente da escala dele, mas não pode ignorar a capacidade/conflitos já estabelecidos para encaixes.

## Solution

Unificar o cálculo de horários em uma política compartilhada de agenda, derivada sempre do estado atual do tenant. O intervalo de grade configurado em Configurações será a única fonte para gerar slots: quando ele mudar, a grade da rota `/agenda`, os horários do modal de bloqueios, os controles de profissionais e os seletores dependentes deverão usar o novo valor sem reload. A alteração de abertura, fechamento ou intervalo deve ser aplicada individualmente ao dia da semana afetado, em desktop e mobile, sem manter valores antigos em memória. Por exemplo, terça-feira alterada de `09:00–18:00` para `09:00–15:00` deve terminar sua grade normal às 15:00, sem alterar os demais dias.

Manter duas políticas explícitas dentro do mesmo fluxo:

- Agendamento normal: respeita expediente do tenant, escala e intervalo do profissional, quebras, antecedência, timezone e restrições de passado.
- Encaixe: pode usar qualquer data, horário e dia, inclusive fora do expediente e fora da escala do profissional, desde que o horário esteja alinhado ao intervalo configurado do tenant, o profissional esteja ativo/não excluído e as regras de conflito/capacidade sejam preservadas.

Manter o expediente do tenant como expediente oficial. Um encaixe fora dele deve ampliar somente a janela visual necessária para exibir o atendimento; não deve alterar o expediente salvo nem criar slots normais fora do expediente. O encaixe deve usar a mesma estrutura de card já utilizada pelos agendamentos, com `appointment.is_fitting` como indicador e sem um segundo componente de card exclusivo.

Adicionar o fluxo de no-show com atualização condicional do atendimento, rótulo visual próprio e encerramento operacional somente da comanda aberta vinculada. A ação `Cliente não compareceu` deve ser independente de `Cancelar agendamento`, usar o status `no_show` que já existe no domínio e não criar um novo status. Uma comanda já fechada deve preservar seu histórico. A proteção financeira será aplicada tanto no cliente quanto no banco, com o banco como autoridade contra concorrência e outros clientes.

## User Stories

1. As a gerente, I want to change the tenant's business hours and see the Agenda update immediately, so that I do not need to reload the application.
2. As a gerente, I want to change the tenant's grid interval and see every dependent time selector use the new interval immediately, so that the operation follows the configuration currently saved.
3. As a gerente, I want the daily and weekly normal appointment grid to be generated from the current tenant business hours and grid interval, so that the visual schedule reflects the official operation.
4. As a gerente, I want a fitting to be created on a closed tenant day, so that an exceptional walk-in can be recorded without opening that day as normal business.
5. As a gerente, I want a fitting to be created before opening or after closing, so that the system represents real operational exceptions.
6. As a gerente, I want a fitting to be registered in the past, so that a walk-in already served can be recorded at the actual time it occurred.
7. As a gerente, I want a fitting to be registered in any future date, so that exceptional arrangements are not constrained by the normal booking window.
8. As a gerente, I want a fitting time to follow the configured tenant grid interval, so that exceptional entries still align with the operational time scale.
9. As a gerente, I want an invalid fitting time that is not aligned to the configured interval to be rejected, so that the agenda does not contain ambiguous grid positions.
10. As a gerente, I want to select any active professional for a fitting regardless of that professional's working hours, so that I can assign the walk-in to the person actually handling it, as in the barbershop flow.
11. As a gerente, I want inactive or deleted professionals excluded from fitting selection, so that an operational exception cannot be assigned to an unavailable account.
12. As a gerente, I want fitting capacity and conflict rules to remain enforced, so that allowing an exception does not produce duplicate or impossible assignments.
13. As a gerente, I want the existing capacity of one normal appointment plus one fitting to remain unchanged, so that current floor operations are not broken.
14. As a gerente, I want a second fitting that conflicts with an existing fitting for the same professional to be rejected according to the current rule, so that the same capacity is respected across desktop, mobile and direct database writes.
15. As a gerente, I want a fitting outside official business hours to appear in the Agenda with the regular card structure, so that it remains visible and actionable like other appointments.
16. As a gerente, I want fittings to have a distinct color and an `Encaixe` label, so that I can identify exceptions without confusing them with normal appointments.
17. As a gerente, I want the visual grid to expand only as much as necessary for an out-of-hours fitting, so that the official business hours remain clear.
18. As a gerente, I want the mobile Agenda to show out-of-hours fittings while keeping normal empty slots inside official hours, so that desktop and mobile communicate the same operational state.
19. As a gerente, I want the block modal to show no normal slots on a closed tenant day, so that I cannot create a regular block where the business is closed.
20. As a gerente, I want block slots on an open day to be limited by the tenant's hours, so that a professional schedule cannot accidentally extend official operation.
21. As a gerente, I want a professional's narrower schedule, breaks, appointments and existing blocks to reduce the tenant window, so that available block slots represent the real intersection of constraints.
22. As a gerente, I want the block modal to recalculate when I select another day or when tenant settings change, so that stale values are not used.
23. As a gerente, I want a new professional's default schedule to derive from the current tenant hours, so that fixed default values do not create invalid availability.
24. As a gerente, I want closed tenant days to start inactive in a professional form, so that the saved schedule does not suggest availability on a closed day.
25. As a gerente, I want legacy professional schedules to be presented and validated within the current tenant limits, so that old data does not break editing or create new invalid availability.
26. As a gerente, I want changing a professional's start/end time to keep the break inside that window, so that the form cannot submit an internally inconsistent schedule.
27. As a gerente, I want the comanda origin to show `Encaixe` when it is linked to a fitting, so that the cashier understands how the customer entered the operation.
28. As a gerente, I want the comanda origin to show `Agendamento` when it is linked to a normal appointment, so that the cashier can distinguish scheduled service from a walk-in.
29. As a gerente, I want an unlinked comanda to remain identified as balcão/avulsa, so that the system does not guess its origin from unrelated fields.
30. As a gerente, I want the same comanda-origin result on desktop and mobile, so that operational decisions do not depend on the screen used.
31. As a gerente, I want to mark a passed `pending` appointment as `no_show`, so that the schedule reflects that the customer did not attend.
32. As a gerente, I want to mark a passed `confirmed` appointment as `no_show`, so that confirmed absences are represented consistently.
33. As a gerente, I want the no-show action hidden or rejected before the appointment has passed, so that the status cannot be used prematurely.
34. As a gerente, I want the no-show action unavailable for `in_progress`, `completed`, `canceled` and already `no_show` appointments, so that the appointment state machine remains valid.
35. As a gerente, I want `Cliente não compareceu` to remain a different action from `Cancelar agendamento`, so that the operational reason is preserved in the appointment status.
36. As a gerente, I want the no-show update to recheck the current status at save time, so that concurrent actions cannot overwrite a newer state.
37. As a gerente, I want a no-show appointment to remain visible in the Agenda with a distinct label and visual state, so that the historical operational event is not lost.
38. As a gerente, I want an open comanda linked to a no-show appointment to be canceled automatically, so that it cannot remain available for accidental checkout.
39. As a gerente, I want a previously closed comanda to remain closed when its appointment becomes no-show, so that financial history is never rewritten.
40. As a gerente, I want the system to prevent new payments or closing a comanda linked to a no-show, so that no financial movement can be generated after the absence.
41. As a gerente, I want the client to show a clear no-show error before attempting an invalid checkout, so that the cashier receives immediate feedback.
42. As a gerente, I want the database to enforce the no-show financial rule even if another client bypasses the interface, so that data integrity does not depend only on frontend behavior.
43. As a gerente, I want existing automatic comanda creation, cancellation, notification and WhatsApp flows to continue working for normal appointments, so that the new behavior does not break the current operation.
44. As a gerente, I want service cards to fit a 390px mobile viewport without horizontal scrolling, so that I can manage the catalog on a phone.
45. As a gerente, I want long service names, prices, duration, status and edit/delete actions to remain readable and accessible on mobile, so that compact layout does not remove essential information or controls.
46. As a gerente, I want the desktop service card layout to remain unchanged, so that the mobile adjustment does not regress the larger screen experience.
47. As a developer, I want all date calculations to use the tenant timezone, so that a fitting, no-show action or agenda day does not shift around midnight.
48. As a developer, I want the current tenant settings to be normalized once and consumed by all schedule surfaces, so that different screens cannot interpret the same day or interval differently.
49. As a developer, I want database changes to be versioned and tested through the existing migration workflow, so that production schema changes are reproducible.
50. As an operator, I want existing normal appointments to continue following their current restrictions, so that the exceptional fitting behavior does not weaken normal booking rules.

## Implementation Decisions

- The main domain seam is a shared schedule policy module. It owns time parsing, tenant-day lookup, professional/tenant intersection, interval alignment and generation of normal or fitting slots. UI components consume the policy rather than reproducing business rules locally.
- The tenant context remains the reactive source of `business_hours`, `slot_interval_minutes`, `timezone` and lead-time settings. An explicit refresh after a successful configuration save and the realtime tenant update must pass through the same normalization path.
- The grid interval is never a fixed frontend constant. The current tenant value is used for normal slots, fitting slots, block-modal slots and all time selectors. Fitting slots are anchored at the beginning of the tenant-local day so they remain selectable outside official business hours.
- Normal appointments and fittings share the same appointment model and persistence path. The distinction is the existing `is_fitting` field, not a second table, route or heuristic.
- Normal appointments keep the current business-hours, professional-schedule, break, lead-time, past-date and timezone validations.
- Fittings bypass tenant business-hours and professional schedule/break validation, including when selecting the professional. They still require an active, non-deleted professional, valid customer/service data, tenant timezone conversion, interval alignment and existing conflict/capacity validation.
- The database boundary validation already treats fittings as exceptional for schedule boundaries. That behavior is retained; no broad weakening of normal appointment validation is allowed.
- Fitting capacity must be preserved from the current product behavior: a normal appointment and one fitting may share the operational slot, but a second fitting that overlaps the same professional, or any otherwise disallowed conflict, must not be accepted. The exact existing conflict predicate is the compatibility contract for the change; allowing a fitting to ignore the professional's schedule must never be interpreted as allowing it to ignore another appointment assigned to that professional.
- An out-of-hours fitting affects only the visual range needed to display its card. It does not mutate tenant hours, professional hours or the set of normal slots.
- The block modal uses tenant business hours as the outer window and intersects them with the selected professional's effective schedule, breaks, appointments and blocks. A closed tenant day produces no normal block slots.
- Professional form defaults and validation derive from normalized tenant hours. Closed days start inactive. Legacy saved schedules are handled safely at edit/submit time; the system must not silently destroy a saved closed-day value solely because the tenant is closed.
- The comanda origin is derived only from the existing `appointment_id` relationship and its `is_fitting` value. The existing Comandas integration is corrected at its data-enrichment boundary rather than replaced with a second solution. The adapter normalizes the one-to-one relation whether the client receives an object or a single-item array and preserves `true`, `false` and `null` distinctly; an unlinked comanda remains balcão/avulsa.
- `no_show` is an appointment status transition allowed only from `pending` or `confirmed` after the appointment has passed in the tenant timezone. The update is conditional so concurrent updates cannot silently replace another valid state.
- When an appointment becomes `no_show`, only an open linked comanda is changed to `cancelada`. Closed comandas, payment history and completed financial records are preserved.
- A versioned database migration adds or adjusts trigger protections for the no-show transition, payment insertion and closing of a linked comanda. Trigger functions use a fixed search path and the minimum privileges required. No new browser-facing RPC is introduced unless the existing policy model proves it necessary during implementation.
- The client comanda adapter performs a preflight for a clear user-facing error, but database protections remain authoritative for race conditions and alternate clients.
- Existing automatic comanda creation remains in place. The new no-show behavior extends the existing lifecycle rather than replacing it with a parallel workflow.
- Service card changes are mobile-only responsive layout changes. Desktop markup and behavior remain stable except for shared class hooks required by the responsive rules.
- The implementation must follow the current React performance conventions: derive values during render or memoization, avoid effect-driven derived state, avoid duplicated inline component definitions and avoid sequential independent data requests when they can safely run in parallel.
- Database exploration, validation, migration application and post-migration advisor checks use the Supabase MCP. The repository migration is the reviewable and reproducible source of truth.

## Testing Decisions

- Tests validate externally observable behavior and domain contracts, not implementation details such as a particular hook, loop or CSS declaration.
- The highest-value unit seam is the shared schedule policy: interval alignment, fitting-day slot generation, tenant/professional intersection, closed days, breaks and timezone-safe day boundaries are tested with deterministic inputs.
- Agenda tests cover both desktop and mobile behavior: settings-derived interval, each weekday's independent opening/closing values, the Tuesday `09:00–15:00` example, fitting in open/closed/out-of-hours/past/future contexts, the mobile past-slot entry point, professional selection outside scale, normal-vs-fitting restrictions, capacity/conflicts, labels and visual persistence of no-show.
- Configuration/context tests verify that a successful save changes the values consumed by dependent surfaces without a reload and that realtime/explicit refresh use identical normalization.
- Block-modal tests use a tenant window wider than, equal to and narrower than the professional window, plus closed days, breaks, appointments, blocks and a changed slot interval.
- Professional-form tests cover dynamic defaults, closed-day inactivity, legacy schedule editing, tenant-bound clamping and keeping a break inside a changed working window.
- Comanda adapter/page tests cover fitting (`true`), normal appointment (`false`) and counter/balcão (`null`/unlinked) origins, including the relation shape returned by Supabase and the existing badge behavior in all supported cases.
- No-show frontend tests cover eligibility, tenant-local past calculation, conditional status behavior, labels on both screen variants and prevention of checkout for canceled no-show comandas.
- Database tests use the existing pgtap style and an isolated transaction/rollback. They verify fitting boundary exceptions, normal appointment boundary enforcement, no-show eligibility/lifecycle, open-comanda cancellation, closed-comanda preservation, payment/close rejection and idempotence.
- Existing tests for normal appointment creation, automatic comandas, cancellation, WhatsApp/notifications, professional schedule boundaries, tenant-hour adjustments and closing-time slots remain part of the regression suite.
- Responsive verification includes a roughly 390px viewport for service cards and mobile Agenda, confirms service-card priority order (name, price, duration, status, actions), verifies compact edit/delete touch targets, plus a desktop viewport to detect layout regressions.
- Final verification runs focused tests first, then the complete test suite, lint and production build. Supabase advisors and the applied migration list are inspected after database changes.
- Acceptance testing uses a matrix with at least two tenant intervals, including 30 and 40 minutes, and tenant timezones represented by the current project data.

## Out of Scope

- Redesigning the tenant business-hours data model or adding a second schedule table.
- Changing the official business hours automatically because a fitting exists.
- Allowing normal appointments to bypass business hours, professional schedules, breaks, lead time or past-date restrictions.
- Removing or weakening the current active-appointment conflict/capacity rules.
- Creating a separate fitting entity, duplicate appointment route or alternate origin heuristic.
- Rewriting closed historical comandas, payments, cash sessions or completed financial movements.
- Automatically marking appointments as no-show without an explicit authorized operational action or a separately specified background process.
- Changing WhatsApp message templates, notification timing or external provider behavior except where existing triggers must remain compatible with the new valid status.
- Redesigning the full Agenda, checkout or service catalog; the UI work is limited to the stated labels, states, responsive card organization and required controls.
- Destructive cleanup of legacy professional schedules on closed days unless a later migration is separately approved with an explicit data policy.
- Introducing a new public RPC, realtime channel or caching layer solely to implement these behaviors.

## Further Notes

- The current database contains tenant-specific timezones and slot intervals, so tests must not assume the browser timezone or one global interval.
- Existing database inspection shows normal appointment overlap protection is separate from fitting capacity behavior. Implementation must first reproduce the current UI/database behavior and then add regression tests before changing the fitting path.
- The user-facing operational rule is the source of truth for professional selection: fitting selection is manual and independent of professional attendance hours, while active/deleted status and conflict/capacity remain safety boundaries.
- If a saved configuration changes while an agenda or modal is open, the next derived render must use the new tenant value; stale form state must be normalized without changing an already persisted appointment.
- No migration should be applied during specification review. During implementation, create the migration through the repository's migration command, validate the SQL with the Supabase MCP, apply it through the MCP workflow, run database tests/advisors and then verify the migration is recorded.
- The implementation plan associated with this specification remains the execution checklist; this document defines the product behavior, architectural decisions and test contract.
