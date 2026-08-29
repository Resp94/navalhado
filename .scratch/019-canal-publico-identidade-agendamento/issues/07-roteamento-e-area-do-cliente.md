# 07 — Roteamento e manutenção da área do cliente

**What to build:** Após o agendamento ou reconhecimento, o cliente chega à área correta e continua podendo gerenciar seus agendamentos sem regressão.

**Blocked by:** 06 — Cliente reconhecido com dados editáveis.

**Status:** concluído

- [x] Token válido direciona para a área de cliente correspondente ao tenant correto.
- [x] A área lista os agendamentos autorizados para aquele cliente e mantém os estados atuais.
- [x] Cancelamento continua respeitando a antecedência e as regras existentes.
- [x] Reagendamento continua respeitando disponibilidade, duração e conflitos.
- [x] O cliente consegue iniciar um novo agendamento sem perder o contexto válido.
- [x] Tokens inválidos ou dados inconsistentes retornam ao fluxo público de forma segura.
- [x] Existem testes de regressão para cancelamento, reagendamento, novo agendamento e troca de navegador sem token local.
