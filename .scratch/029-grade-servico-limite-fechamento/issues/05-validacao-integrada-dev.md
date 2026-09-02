# 05 — Validação integrada somente em DEV

**What to build:** Uma validação reproduzível no ambiente DEV que prove o comportamento da Agenda interna e do link público, a persistência no banco e a ausência de regressões antes de qualquer promoção.

**Blocked by:** 04 — Preservação dos fluxos operacionais e da paridade visual.

**Status:** ready-for-agent

- [ ] Criar dados de teste somente no banco DEV, identificá-los com segurança e removê-los ao final da validação quando não forem necessários para o snapshot.
- [ ] Consultar o banco DEV via MCP antes e depois dos cenários, confirmando funções, migration, duração, expediente, horários e registros persistidos.
- [ ] Validar o cenário principal: fechamento às 19:00, grade de 40 minutos e serviço de 40 minutos; `18:40` aparece na régua interna, não pode ser confirmado no agendamento normal e não aparece no link público.
- [ ] Validar o cenário positivo: serviço curto que termina até o fechamento pode usar `18:40` no fluxo normal e no link público.
- [ ] Repetir os cenários com intervalos diferentes de 20, 30 e outro valor configurado, sem assumir 40 minutos.
- [ ] Validar fechamento antecipado do profissional, fechamento antecipado da barbearia, intervalo, duração específica, fallback e término exatamente no fechamento.
- [ ] Validar profissional único, vários profissionais e seleção de qualquer profissional.
- [ ] Validar horários passados, bloqueados, ocupados e fora da antecedência mínima.
- [ ] Validar encaixe pela grade e encaixe personalizado fora do expediente, incluindo exibição do card no horário persistido.
- [ ] Validar reagendamento normal interno e reagendamento por sessão/token no link público.
- [ ] Validar abertura e finalização da comanda, pagamento, estado visual e regras de mensageria sem alterações indevidas.
- [ ] Repetir a validação visual no navegador integrado em desktop e mobile 390×844, registrando prints sem expor credenciais, tokens, secrets ou telefones completos.
- [ ] Comparar as evidências com os snapshots e relatórios das Specs 023, 024, 025 e 028.
- [ ] Executar testes unitários, testes de componentes, testes pgTAP e build, registrando falhas e correções.
- [ ] Confirmar que PROD e `main` não foram alterados durante a validação de DEV.
- [ ] Produzir relatório final com cenários aprovados, evidências, persistência, regressões e pendências residuais.

