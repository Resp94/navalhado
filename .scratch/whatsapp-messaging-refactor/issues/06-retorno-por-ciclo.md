# 06 — Retorno por ciclo

**What to build:** O sistema identifica clientes elegíveis para retorno, monta a mensagem usando o período do serviço e envia uma única vez por ciclo, respeitando timezone, idempotência, templates personalizados e agendamentos futuros.

**Blocked by:** 01 — Seam de despacho e baseline de regressão; 03 — Contrato canônico de templates; 05 — Welcome de balcão durável

**Status:** ready-for-agent

- [ ] Fixtures com atendimento concluído permitem validar o retorno sem depender de dados produtivos.
- [ ] O período configurado no serviço determina a elegibilidade conforme a regra de negócio aprovada.
- [ ] O cálculo respeita o timezone do tenant e não depende do timezone do navegador ou do worker.
- [ ] Cliente com atendimento futuro confirmado ou pendente é tratado conforme a regra atual e tem motivo de supressão observável.
- [ ] Template padrão e customizado são renderizados sem `{cliente}`, `{servico}`, `{dias}`, `{link}` ou aliases residuais.
- [ ] O mesmo ciclo não é enviado duas vezes em execuções concorrentes ou em dias consecutivos.
- [ ] Um novo atendimento concluído cria uma nova oportunidade de retorno.
- [ ] Falhas temporárias ficam reprocessáveis e falhas permanentes permanecem auditáveis sem marcar envio como sucesso.
