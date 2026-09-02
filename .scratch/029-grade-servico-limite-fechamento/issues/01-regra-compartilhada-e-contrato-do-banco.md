# 01 — Regra compartilhada de duração e limite de fechamento

**What to build:** Uma regra única de disponibilidade normal que determine se o atendimento completo cabe no expediente efetivo, usando a duração real do serviço e protegendo a mesma decisão nas consultas e confirmações do banco.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Criar ou aprofundar o seam temporal existente para avaliar `início + duração efetiva`, aceitando qualquer intervalo configurado da grade, sem depender de 20, 30 ou 40 minutos.
- [ ] Usar a duração específica de `professional_services` somente quando estiver configurada, válida e habilitada; caso contrário, usar a duração cadastrada no serviço.
- [ ] Considerar o menor fechamento entre o funcionamento da barbearia e a escala do profissional, com término exatamente no fechamento permitido.
- [ ] Impedir que a duração atravesse o intervalo do profissional.
- [ ] Diferenciar visualização da régua interna de elegibilidade para agendamento normal: o slot pode existir como referência visual, mas não ser elegível para confirmação.
- [ ] Atualizar as funções de disponibilidade interna, por sessão/token e pública sem quebrar suas assinaturas, grants, isolamento por `tenant_id` ou comportamento de bloqueios e conflitos.
- [ ] Revalidar no servidor a condição de fechamento durante a confirmação de um agendamento normal, aceitando término exatamente no fechamento e rejeitando término posterior.
- [ ] Manter `SECURITY DEFINER` com `search_path` fixo, referências qualificadas e sem ampliar permissões anônimas.
- [ ] Não criar tabela ou coluna nova; se a definição das funções precisar ser alterada, criar migration com o próximo número cronológico disponível e nunca editar migrations históricas.
- [ ] Aplicar a migration somente no banco DEV usando o MCP do Supabase e registrar o resultado da persistência.
- [ ] Criar ou atualizar testes pgTAP para fechamento da barbearia, fechamento do profissional, duração específica, fallback, intervalo, timezone, qualquer profissional e isolamento entre tenants.

