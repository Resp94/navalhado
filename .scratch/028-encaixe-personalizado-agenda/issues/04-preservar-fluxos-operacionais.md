# 04 — Preservação dos fluxos operacionais

**What to build:** O novo modo de encaixe personalizado convive com os fluxos existentes de agendamento normal, comanda, pagamento, não comparecimento, estado visual e mensageria sem regressões.

**Blocked by:** 01 — Seam de horário para encaixes; 02 — Encaixe personalizado no painel do gerente; 03 — Paridade do encaixe na Agenda desktop e mobile

**Status:** ready-for-agent

- [ ] Manter agendamento normal limitado ao funcionamento da barbearia, escala, intervalo, bloqueios, duração e antecedência aplicáveis.
- [ ] Garantir que somente o encaixe explícito ignore os limites de expediente e de grade.
- [ ] Manter a abertura e a criação automática da comanda.
- [ ] Manter pagamento, finalização e atualização do card.
- [ ] Manter a ação de marcar não comparecimento para encaixes quando aplicável.
- [ ] Manter o card totalmente verde somente conforme a regra atual de conclusão do atendimento e da comanda.
- [ ] Manter confirmações WhatsApp de encaixes futuros e suprimir confirmações de encaixes passados conforme a regra existente.
- [ ] Preservar a proteção atual contra duplicidade acidental do mesmo encaixe.
- [ ] Confirmar isolamento de tenant e ausência de dados sensíveis nos logs.
