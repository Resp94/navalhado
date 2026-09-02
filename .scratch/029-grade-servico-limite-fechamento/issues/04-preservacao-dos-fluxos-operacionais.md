# 04 — Preservação dos fluxos operacionais e da paridade visual

**What to build:** Integrar a nova disponibilidade sem alterar os comportamentos operacionais já validados: encaixe personalizado, cards persistidos, comanda, pagamentos, mensageria e visualização desktop/mobile.

**Blocked by:** 02 — Disponibilidade normal na Agenda interna; 03 — Disponibilidade correta no link público.

**Status:** ready-for-agent

- [ ] Confirmar que encaixes personalizados continuam aceitando qualquer horário local válido, inclusive em dia passado, dia fechado, fora da escala e depois do fechamento.
- [ ] Confirmar que encaixes personalizados continuam calculando o término pela duração efetiva sem truncar no expediente.
- [ ] Confirmar que encaixes pela grade obedecem à disponibilidade normal, enquanto o modo personalizado permanece uma exceção explícita.
- [ ] Confirmar que o slot visual interno pode permanecer na régua mesmo quando não há serviço elegível para o agendamento normal.
- [ ] Confirmar que cards existentes fora do expediente continuam visíveis, ordenados pelo horário persistido e com duração visual correta.
- [ ] Confirmar que abertura, finalização, pagamento, cores dos cards, “não compareceu” e ações da comanda não foram alterados.
- [ ] Confirmar que encaixes passados continuam sem confirmação WhatsApp e que encaixes futuros seguem as regras existentes da mensageria.
- [ ] Confirmar que desktop e mobile usam a mesma decisão de domínio sem consultas duplicadas, listeners extras ou N+1 de serviços.
- [ ] Confirmar que as configurações `business_hours`, `weekly_schedule`, `slot_interval_minutes` e antecedência não são alteradas como efeito colateral.
- [ ] Confirmar que sessão pública, Turnstile, gerenciamento de agendamentos e autenticação anônima permanecem fora do escopo da alteração.
- [ ] Registrar regressões encontradas e corrigi-las somente quando relacionadas ao novo limite de disponibilidade.

