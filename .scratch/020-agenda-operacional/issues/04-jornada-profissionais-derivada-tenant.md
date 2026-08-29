# 04 — Derivar jornada dos profissionais do expediente do tenant

**What to build:** Fazer o cadastro e a edição de profissionais acompanharem dinamicamente o funcionamento da barbearia, impedindo jornadas normais fora dos limites configurados para cada dia.

**Blocked by:** 01 — Sincronizar expediente e intervalo com a Agenda

**Status:** completed

- [x] Defaults de novos profissionais usam abertura e fechamento atuais do tenant, sem horários fixos globais.
- [x] Dias fechados iniciam inativos e não permitem configurar jornada normal ativa.
- [x] Início, fim, início do intervalo e fim do intervalo respeitam os limites do dia correspondente do tenant.
- [x] Alterar posteriormente o expediente do tenant atualiza os limites apresentados na edição do profissional.
- [x] Jornadas legadas fora da nova faixa são normalizadas/validadas com segurança ao editar e salvar, sem apagar silenciosamente valores de dia fechado.
- [x] Alterar início ou fim ajusta o intervalo para continuar dentro da jornada profissional.
- [x] A proteção existente no banco continua ativa como defesa final.
- [x] Existem testes para defaults dinâmicos, dia fechado, mudança de tenant, jornada legada e intervalo interno válido.
