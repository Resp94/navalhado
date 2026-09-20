# 01: Barbeiro opera a própria agenda no banco

**What to build:** o barbeiro passa a criar Agendamento e encaixe, reagendar (só data e hora), cancelar e marcar "não compareceu" nos Agendamentos dele, pelas mesmas RPCs do gestor. Em troca, perde toda escrita direta que não lhe compete: Agendamentos, Comandas, Itens de Comanda, produtos, Lista de Espera e clientes. O gestor não percebe nenhuma mudança.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Cancelar, marcar falta e reagendar aceitam o barbeiro dono do Agendamento e recusam Agendamento alheio com `42501`
- [x] Reagendar feito por barbeiro recusa troca de profissional com `42501`; gestor continua podendo trocar
- [x] Criar Agendamento aceita barbeiro só com o próprio profissional; recusa outro profissional, "Tanto faz" e entrada da Lista de Espera
- [x] Barbeiro cria Agendamento e encaixe com cliente existente e com cliente novo; limite de encaixe, expediente, escala, conflito e Bloqueio de Horário valem para ele
- [x] Comanda do Agendamento criado pelo barbeiro nasce pelo gatilho e é cancelada quando ele cancela
- [x] Políticas de acesso: barbeiro sem inserir/atualizar em Agendamentos, Comandas, Itens de Comanda, Lista de Espera e clientes, sem atualizar produtos e sem escrever na Associação Profissional-Servico (achada na auditoria: era escrita por qualquer usuário da barbearia); leitura inalterada
- [x] Antes de fechar cada tabela, conferido que nenhum código do barbeiro ainda escreve nela direto (o "Finalizar" legado sai no ticket 02)
- [x] Isolamento entre barbearias: barbeiro da barbearia A recusado em criar, reagendar, cancelar e marcar falta na barbearia B, mesmo passando o identificador dela; cliente, serviço, profissional e entrada de Lista de Espera de outra barbearia recusados na criação
- [x] Barbeiro com barbearia nula, barbeiro desativado e usuário cuja barbearia não bate com a do cadastro de profissional: recusados em toda escrita
- [x] Leitura: barbeiro da barbearia A não enxerga nenhuma linha da barbearia B em Agendamentos, clientes, serviços, profissionais, Comandas e Bloqueios de Horário
- [x] pgTAP novo, com duas barbearias no mesmo teste, cobre cada aceite e cada recusa acima, Bloqueio próprio aceito e alheio recusado, gestor sem regressão, gestor com `tenant_id` nulo recusado e proprietário aceito
- [x] Migration aplicada só no DEV; `get_advisors` sem alerta novo
- [x] `npm run lint`, `npm test` e `npm run build` passam
