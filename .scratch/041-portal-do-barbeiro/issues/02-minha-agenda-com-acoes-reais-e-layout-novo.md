# 02: Minha Agenda com ações reais e layout novo

**What to build:** o barbeiro abre a Minha Agenda e vê a própria agenda no mesmo componente da agenda mobile do gestor, com um profissional só, no celular e no desktop. Dali ele cria Agendamento e encaixe, reagenda (só data e hora), cancela, marca "não compareceu" e cria ou remove o próprio Bloqueio de Horário, sempre com o profissional travado nele. "Iniciar", "Finalizar", o modal de pagamento e os cards estimados somem. O layout do barbeiro segue o padrão mobile atual do painel.

**Blocked by:** 01 — Barbeiro opera a própria agenda no banco

**Status:** done

- [x] Prefactor: modais de criação e encaixe, reagendamento, cancelamento e falta extraídos da Agenda Geral para componentes compartilhados, com opção de profissional fixo; testes atuais da Agenda Geral verdes sem mudar comportamento
- [x] Minha Agenda reusa a agenda mobile do gestor com um profissional só; Cobrar e Lista de Espera não aparecem
- [x] Criar, encaixe, reagendar, cancelar e não compareceu funcionam pelo AgendaRepository, com o profissional travado no barbeiro
- [x] Recusa do banco aparece como mensagem clara, sem perder o que foi preenchido
- [x] Bloqueio de Horário próprio criado e removido pelo modal do gestor, com profissional travado
- [x] Removidos: "Iniciar", "Finalizar", modal de pagamento, cards de faturamento e comissão estimados, chamadas diretas ao Supabase para escrita
- [x] Layout do barbeiro alinhado ao padrão mobile do gestor (header e navegação inferior: Minha Agenda, Comissões, Sair)
- [x] A barbearia usada nas chamadas vem do vínculo de profissional do usuário logado, nunca da URL ou de estado do navegador
- [x] Testes de tela: ações proibidas ausentes, profissional travado nos modais, barbearia derivada do vínculo
- [x] Verificado no navegador com o barbeiro de teste do DEV, no celular e no desktop
- [x] `npm run lint`, `npm test` e `npm run build` passam
