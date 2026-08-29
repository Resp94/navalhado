# 08 — Observabilidade e segurança operacional

**What to build:** Toda tentativa de mensageria pode ser diagnosticada por evento, tenant e tentativa sem expor PII ou credenciais, com limites de tempo, grants e autenticação adequados.

**Blocked by:** 02 — Primeiro contato resiliente; 04 — Envio manual compatível; 05 — Welcome de balcão durável; 06 — Retorno por ciclo; 07 — Eventos de appointment sem regressão

**Status:** ready-for-agent

- [ ] Cada evento possui correlation ID, tenant, tipo, aggregate ID, tentativa, duração, status e status do provider.
- [ ] Logs não contêm token da instância, segredo de trigger, JWT, telefone completo nem corpo integral da mensagem.
- [ ] O adapter possui timeout explícito e classifica erros retryable e permanentes de forma consistente.
- [ ] Respostas externas não expõem corpo bruto ou credenciais da UAZAPI.
- [ ] Falhas de RPC, renderização, outbox, worker e provider podem ser diferenciadas operacionalmente.
- [ ] Funções privilegiadas mantêm search path explícito e grants mínimos.
- [ ] A autorização impede envio manual ou processamento de evento de outro tenant.
- [ ] Métricas distinguem sucesso, falha, retry, skip, duplicidade e latência.
- [ ] Os advisors do Supabase e a lista de migrações aplicadas são revisados após alterações de banco.
