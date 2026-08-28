# 04 — Restrições reais de disponibilidade profissional

**What to build:** A grade pública aplica a agenda individual, pausas, bloqueios e conflitos do profissional sem alterar a estrutura temporal exibida pelo estabelecimento.

**Blocked by:** 03 — Grade de horários baseada no estabelecimento.

**Status:** ready-for-agent

- [ ] A disponibilidade considera a agenda do profissional selecionado quando houver um profissional específico.
- [ ] Pausas, bloqueios, agendamentos conflitantes e status que ocupam horário tornam o slot indisponível.
- [ ] O modo de escolha livre respeita apenas profissionais qualificados e disponíveis para o serviço.
- [ ] A grade continua exibindo slots indisponíveis de forma consistente, sem deslocar ou remover a malha temporal esperada.
- [ ] Existem testes de banco e interface para conflito, bloqueio, pausa, profissional sem agenda e escolha livre.
