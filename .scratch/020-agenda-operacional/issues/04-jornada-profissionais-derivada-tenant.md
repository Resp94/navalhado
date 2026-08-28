# 04 — Derivar jornada dos profissionais do expediente do tenant

**What to build:** Fazer o cadastro e a edição de profissionais acompanharem dinamicamente o funcionamento da barbearia, impedindo jornadas normais fora dos limites configurados para cada dia.

**Blocked by:** 01 — Sincronizar expediente e intervalo com a Agenda

**Status:** ready-for-agent

- [ ] Defaults de novos profissionais usam abertura e fechamento atuais do tenant, sem horários fixos globais.
- [ ] Dias fechados iniciam inativos e não permitem configurar jornada normal ativa.
- [ ] Início, fim, início do intervalo e fim do intervalo respeitam os limites do dia correspondente do tenant.
- [ ] Alterar posteriormente o expediente do tenant atualiza os limites apresentados na edição do profissional.
- [ ] Jornadas legadas fora da nova faixa são normalizadas/validadas com segurança ao editar e salvar, sem apagar silenciosamente valores de dia fechado.
- [ ] Alterar início ou fim ajusta o intervalo para continuar dentro da jornada profissional.
- [ ] A proteção existente no banco continua ativa como defesa final.
- [ ] Existem testes para defaults dinâmicos, dia fechado, mudança de tenant, jornada legada e intervalo interno válido.


