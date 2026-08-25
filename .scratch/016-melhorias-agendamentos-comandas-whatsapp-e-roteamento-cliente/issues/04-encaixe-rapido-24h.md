# 04 — Modal de Encaixe Rápido 24 Horas (00:00 às 23:00)

**What to build:** 
Permitir que o gerente realize o cadastro de encaixes rápidos na agenda em qualquer horário das 24 horas do dia (`00:00` às `23:00` no formato 24 horas) através do modal de novo agendamento. Quando a opção de "Encaixe" for selecionada, o dropdown de horários deve listar todas as opções de 24 horas e o sistema deve ignorar o bloqueio de expediente da barbearia. A exibição principal da grade temporal da agenda deve permanecer restrita exclusivamente aos horários normais de funcionamento da barbearia.

**Blocked by:** 02 — Cancelamento Automático de Comandas e Atualização em Tempo Real (Sem Refresh).

**Status:** completed

- [x] Implementar gerador de slots 24 horas (`00:00` até `23:00`) com o intervalo configurado da barbearia (`slotIntervalMinutes`).
- [x] Alternar o seletor de horários do modal para a lista de 24 horas quando `formIsFitting` estiver ativo.
- [x] Ignorar as validações de trava de fora do expediente e jornada do barbeiro exclusivamente quando for um registro de Encaixe.
- [x] Garantir que a visualização da grade da agenda (`timeSlots`) continue restrita ao horário de funcionamento cadastrado da barbearia.
- [x] Adicionar testes automatizados cobrindo a seleção e gravação de encaixes em horários especiais.
