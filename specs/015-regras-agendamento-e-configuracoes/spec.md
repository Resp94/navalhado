# Especificação Técnica: Reelaboração de /configuracoes e Regras Dinâmicas de Agendamento

## Problem Statement

Atualmente, o sistema **Navalhado** possui limitações estruturais na parametrização de agendamentos e na experiência de configuração da barbearia:

1. **Intervalo Fixo e Engessado de Horários:** A geração de slots da grade pública (`get_available_slots`) opera com um intervalo fixo de 30 minutos (`'30 minutes'::interval`). Barbearias que realizam atendimentos rápidos (ex: 15 ou 20 minutos) ou procedimentos mais longos (ex: 45 ou 60 minutos) não conseguem calibrar a frequência da sua grade de horários, gerando lacunas ociosas ou sobreposições.
2. **Ausência de Trava de Antecedência Mínima para Agendamento Online:** Clientes podem agendar horários online até o exato segundo em que o atendimento começa (`slot_start > now()`). Isso pega barbeiros desprevenidos quando um cliente marca um corte faltando 2 minutos para o início e chega sem tempo hábil de preparação.
3. **Falta de Política de Cancelamento e Reagendamento com Prazos Transparentes:** O cliente pode cancelar seu agendamento no último instante pelo link público, deixando o profissional ocioso sem chance de preencher o horário vago. Não há mecanismo para exigir antecedência mínima de cancelamento nem direcionamento para contato direto com o barbeiro caso o prazo expire.
4. **Página `/configuracoes` Monolítica e Desestruturada:** A tela atual do painel do gerente agrupa todos os dados em um único formulário sem hierarquia visual clara, sem preenchimento automático de endereço por CEP (ViaCEP) e sem controles modernos para ajuste de regras de agendamento.

---

## Solution

Implementar uma solução ponta a ponta que confere autonomia de configuração ao gerente, proteção operacional aos barbeiros e clareza para os clientes:

1. **Parametrização Dinâmica no Banco de Dados (PostgreSQL / Supabase):**
   - Expansão da tabela `public.tenants` com colunas escalares tipadas e `CHECK` constraints: `slot_interval_minutes` (padrão 30m), `min_booking_lead_time_minutes` (padrão 15m) e `min_cancellation_lead_time_minutes` (padrão 120m).
   - Atualização das funções RPC `get_available_slots`, `create_appointment_by_token`, `cancel_appointment_by_token` e `reschedule_appointment_by_token` com validação dupla de regras de negócio, proteção contra concorrência e conformidade com `SECURITY DEFINER` e `search_path = ''`.
2. **Reelaboração Visual e Funcional da Página `/configuracoes`:**
   - Divisão em **3 Cards Temáticos** com GSAP Motion, design tokens do Navalhado e feedback toast:
     - **Card 1 (Perfil & Contato):** Dados cadastrais, telefone mascarado, fuso horário e endereço completo com busca automática por CEP (ViaCEP).
     - **Card 2 (Regras de Agendamento Online):** Seletores rápidos em chips e inputs customizados para intervalo da grade, antecedência de agendamento e antecedência de cancelamento.
     - **Card 3 (Horário de Funcionamento Geral):** Grade semanal com toggles modernos de ativação e horários de abertura/fechamento.
3. **Transparência e Resolução Humanizada no Canal do Cliente:**
   - **Modal de Confirmação (`FluxoAgendamento.tsx`):** Exibição de card informativo destacando as políticas de cancelamento e antecedência da barbearia antes de concluir o agendamento.
   - **Menu do Cliente (`MenuCliente.tsx`):** Em caso de tentativa de cancelamento fora do prazo online permitido, o sistema exibe aviso amigável e botão direto de 1 clique para conversar no WhatsApp do profissional responsável (`wa.me` com `professional.phone`).

---

## User Stories

### A. Painel do Gerente e Configurações (`/configuracoes`)
1. As a Gerente, I want to access `/configuracoes` and view my shop settings organized into 3 clear thematic cards (Perfil & Contato, Regras de Agendamento, Horário de Funcionamento), so that I can manage my business without visual clutter.
2. As a Gerente, I want to type my shop's CEP and have the Street, Neighborhood, City, and State automatically filled via ViaCEP, so that my address remains accurate with minimal effort.
3. As a Gerente, I want to configure the time slot interval (e.g., 15, 20, 30, 45, 60 minutes or a custom value) using quick-select buttons, so that the public booking grid aligns with our service pacing.
4. As a Gerente, I want to set a minimum booking lead time (e.g., 0, 15, 30, 45 minutes, 1 hour, 2 hours or custom), so that customers cannot book last-minute slots without giving barbers time to prepare.
5. As a Gerente, I want to configure a minimum cancellation lead time (e.g., 0, 30 min, 1h, 2h, 4h, 24h or custom), so that customers cannot cancel at the last minute and leave barbers with empty chairs.
6. As a Gerente, I want to toggle operating days on and off and set opening and closing hours for each day of the week, so that appointments only occur during our business hours.
7. As a Gerente, I want immediate visual feedback via Toast and error handling when saving settings, so that I know my changes were successfully persisted in Supabase.

### B. Grade de Horários e Agendamento do Cliente (`/cliente/:token/agendar`)
8. As a Client choosing an appointment time, I want the available time slots to appear in the shop's configured interval (e.g., every 20 minutes), so that I can pick the exact time that suits me.
9. As a Client browsing today's slots, I want slots starting within the minimum lead time (e.g., within the next 15 minutes) to be hidden from the available list, so that I only select viable start times.
10. As a Client on the booking confirmation modal, I want to see a clear policy notice stating until when I can cancel or reschedule for free, so that I have complete transparency before booking.
11. As a Client trying to confirm a booking whose lead-time window closed while I was selecting, I want the system to reject the reservation with a clear and friendly explanation, so that I can pick a valid upcoming slot.

### C. Gestão de Agendamentos e Cancelamentos no Canal do Cliente (`/cliente/:token`)
12. As a Client with an active appointment, I want to see the cancellation policy directly on my appointment card, so that I know the deadlines for making changes.
13. As a Client attempting to cancel an appointment within the allowed cancellation window, I want to cancel smoothly with 1 click and receive instant confirmation.
14. As a Client attempting to cancel an appointment after the cancellation deadline has expired, I want to receive an informative explanation and a direct button to message my barber on WhatsApp, so that I can resolve my schedule change directly with the person cutting my hair.

### D. Agenda Interna e Flexibilidade Operacional (`/agenda`)
15. As a Gerente or Barbeiro at the shop counter, I want to create appointments or walk-in fittings (encaixes) at any moment without being blocked by the online lead-time rule, so that I have total operational autonomy in the physical shop.

---

## Implementation Decisions

### 1. Modelagem Relacional e Integridade (PostgreSQL)
- Inclusão das colunas `slot_interval_minutes`, `min_booking_lead_time_minutes` e `min_cancellation_lead_time_minutes` em `public.tenants` com tipos primitivos inteiros, valores padrão e `CHECK` constraints.
- Não utilizar JSONB genérico para essas configurações para preservar a validação nativa de banco, performance em PL/pgSQL e geração automática de tipagem TypeScript.

### 2. Funções RPC no Supabase
- **`public.get_available_slots`:** Atualizada para ler `slot_interval_minutes` e `min_booking_lead_time_minutes` do tenant, gerando a série temporal com `(v_slot_interval || ' minutes')::interval` e filtrando `s.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)`. Mantém suporte a profissional específico e ao modo "Tanto faz".
- **`public.create_appointment_by_token`:** Validação defensiva no backend para impedir que requisições fora do prazo de antecedência gravem agendamentos.
- **`public.cancel_appointment_by_token`:** Validação da janela `min_cancellation_lead_time_minutes`, lançando erro amigável com código `APPOINTMENT_CANCELLATION_DEADLINE_EXPIRED` caso o prazo tenha expirado.
- **`public.reschedule_appointment_by_token`:** Validação atômica de cancelamento da reserva antiga e criação da nova.
- **`public.get_customer_appointments_by_token`:** Inclusão de `p.phone as professional_phone` no retorno para viabilizar contato direto via WhatsApp com o barbeiro.

### 3. Camada de Domínio (`src/modules/canal-cliente`)
- Extensão da interface `AgendamentoCanal` com `professional_phone?: string`.
- Atualização do `SupabaseCanalClienteAdapter` e `InMemoryCanalClienteAdapter` para repassar o telefone e tratar o erro de prazo de cancelamento.

### 4. Layout e Interface do Gerente (`src/pages/gerente`)
- Expansão de `TenantContextType` em `GerenteLayout.tsx`.
- Redesenho completo de `Configuracoes.tsx` com 3 cards temáticos, integração com a API pública do ViaCEP e seletores interativos com animações GSAP.

### 5. Experiência do Cliente (`src/pages/cliente`)
- Inclusão do aviso de política no modal de confirmação de `FluxoAgendamento.tsx`.
- Inclusão do modal de redirecionamento para WhatsApp do barbeiro em `MenuCliente.tsx`.

---

## Testing Decisions

### O que constitui um bom teste
- Testar o comportamento externo observável do usuário (inputs, botões, mensagens na tela e respostas das RPCs), sem acoplamento a detalhes efêmeros de implementação interna.

### Módulos a serem testados
1. **`src/pages/gerente/__tests__/Configuracoes.test.tsx`:**
   - Renderização inicial dos 3 cards temáticos com dados vindos do banco.
   - Interação com os botões rápidos de intervalo e antecedência.
   - Preenchimento e validação de CEP via ViaCEP.
   - Submissão correta dos novos campos para a tabela `tenants`.
2. **`src/pages/cliente/__tests__/FluxoAgendamento.test.tsx`:**
   - Exibição do disclaimer de política no modal de confirmação.
3. **`src/pages/cliente/__tests__/MenuCliente.test.tsx`:**
   - Bloqueio de cancelamento com prazo vencido e exibição do link para o WhatsApp do profissional.
4. **`src/modules/canal-cliente/__tests__/CanalClienteRepository.test.ts`:**
   - Validação dos contratos do repositório e adaptadores.

---

## Out of Scope

- Pagamentos online antecipados obrigatórios (Pix/Cartão na reserva online) — o foco desta spec é a grade temporal e as regras de antecedência de agendamento e cancelamento.
- Cobrança de taxa por cancelamento tardio — clientes fora do prazo são orientados a contatar o barbeiro diretamente.
- Sistema de multilocais para um mesmo tenant — cada tenant representa uma unidade de barbearia.

---

## Further Notes

- A migração segue o padrão versionado do projeto: `20260818221500_025_booking_rules_and_config.sql`.
- Os links públicos do cliente permanecem com validade vitalícia (`token_expirado_em: NULL`).
- A agenda do gerente e barbeiro (`Agenda.tsx` e `MinhaAgenda.tsx`) preserva 100% de retrocompatibilidade para encaixes presenciais imediatos.
