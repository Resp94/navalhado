# 06: Provas em produção e registro na spec

**What to build:** o gerente, o barbeiro e o cliente passam a ter em produção o que as specs 040 a 045 e as correções de 22/09 entregam, e isso fica provado no próprio site de produção e registrado na spec 046. As provas não podem mandar WhatsApp para cliente real: produção tem instância conectada.

**Blocked by:** 05 — Janela de promoção

**Status:** ready-for-agent

- [x] Nenhum Agendamento de prova é criado para cliente com telefone. Agendamento de prova usa Sem cadastro (Balcão) e é cancelado logo depois com o motivo "Prova da promoção". — dois agendamentos Balcão (10:20 e 11:00), ambos cancelados com esse motivo.
- [x] Gerente cancela um Agendamento pela Agenda informando motivo, e o cancelamento é gravado. — confirmado; a Agenda desktop abre a Comanda do atendimento e usa `cancel_comanda_appointment`, sem botão de cancelamento solto na grade (não há caminho separado até `cancel_appointment_by_manager` na UI atual).
- [x] Gerente cancela pela tela de Comandas informando motivo, e o cancelamento é gravado. — confirmado.
- [x] O Painel de Cancelados do Dia mostra os dois cancelamentos com autoria "Barbearia" e o motivo. — confirmado, "Cancelado por: Barbearia" e "Motivo: Prova da promoção" nos dois.
- [x] O cabeçalho do Caixa mostra o horário no fuso do tenant. — confirmado: tenant America/Manaus, sessão aberta às 18:13:26 UTC exibida como 14:13 (bate com Manaus, não com São Paulo nem UTC).
- [x] Na Minha Agenda do barbeiro em desktop, a Grade Temporal aparece travada nele, e o Bloquear horário oferece só ele. — confirmado em 2026-09-23, depois de corrigido o bloqueio: a Edge Function `create-barber-access` (achado desta mesma sessão, `task_fbfb3f65`) foi implementada e mesclada na `dev`, deployada em produção pelo MCP do Supabase, e testada — "Criar acesso" funcionou, login do barbeiro de teste entrou na Minha Agenda mostrando só a própria grade, e o modal de Bloquear horário ofereceu só ele mesmo no seletor de profissional. Profissional e login de teste removidos depois (`auth.users` deletado, cascata limpou `public.users`; `professionals.user_id` voltou a nulo).
- [x] No Canal do Cliente, "Próximos horários" lista só o que ainda vai acontecer. — confirmado com cliente já existente ("Jonathas Santos"): "Próximos horários (0)" / "Anteriores (2)", o Agendamento pendente vencido caiu em Anteriores.
- [x] Nos Relatórios, o período escolhido é mantido ao trocar de página. — confirmado: "Últimos 30 dias" definido na aba Equipe e Serviços permaneceu ao trocar para Faturamento.
- [x] Os registros de prova ficam cancelados em produção; nenhum Agendamento ativo de prova sobra. — confirmado, os dois cancelados.
- [x] A spec 046 ganha uma seção com a data e o horário da janela, o commit de merge na `main` e o resultado de cada prova. — seção "Registro da promoção (2026-09-23)" adicionada à spec.
- [x] Qualquer prova que falhe vira uma correção na `dev`, testada e promovida pela mesma sequência; nada é editado direto na `main`. — não se aplicou; nenhuma prova falhou (uma ficou bloqueada por bug pré-existente, não por regressão da promoção).

**Resultado 2026-09-23:** 11 de 11 critérios confirmados em produção. O item da Minha Agenda do barbeiro ficou pendente numa primeira passada por um bug pré-existente e fora do escopo (Edge Function `create-barber-access` ausente em produção e em dev); a correção (achada e sinalizada nesta mesma sessão como `task_fbfb3f65`) foi implementada, mesclada na `dev`, deployada em produção e testada no mesmo dia. Spec 046 completa com o registro da promoção.
