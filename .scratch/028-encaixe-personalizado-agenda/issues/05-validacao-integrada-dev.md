# 05 — Validação integrada em DEV

**What to build:** Uma validação completa, reproduzível e documentada do encaixe pela grade e personalizado no ambiente DEV, incluindo persistência, interface desktop/mobile e regressões operacionais.

**Blocked by:** 02 — Encaixe personalizado no painel do gerente; 03 — Paridade do encaixe na Agenda desktop e mobile; 04 — Preservação dos fluxos operacionais

**Status:** ready-for-agent

- [ ] Executar testes automatizados do domínio, formulário, Agenda e comanda.
- [ ] Validar encaixe em grade de 40 minutos e encaixe personalizado em minuto não alinhado, como 18:10.
- [ ] Validar barbeiro e barbearia encerrando às 17:00 com encaixe às 18:00.
- [ ] Validar serviço de 60 minutos iniciado às 18:00 sem truncar o horário final.
- [ ] Validar dias passado, atual e futuro.
- [ ] Confirmar no banco DEV os valores de `start_time`, `end_time`, `is_fitting` e `origin` após o cadastro.
- [ ] Confirmar que agendamento normal fora do expediente continua bloqueado.
- [ ] Confirmar comanda, pagamento, finalização, não comparecimento e estado visual.
- [ ] Confirmar regras de mensageria para encaixe passado e futuro.
- [ ] Repetir a validação visual no navegador integrado em desktop e mobile 390 x 844.
- [ ] Registrar prints sem expor credenciais, tokens, secrets ou telefones completos.
- [ ] Remover dados temporários de teste após a validação, sem tocar em PROD.
