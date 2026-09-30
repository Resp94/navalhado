# 15: Ferramentas do Proprietário

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** em Admin > Tenants, o Proprietário vê a assinatura de cada barbearia e resolve os casos de suporte sem abrir o banco.

- Funções do banco só para o Proprietário:
  - **estender o teste** até uma data
  - **cortesia:** marcar e desmarcar, com data de fim opcional; sem cobrança e sem bloqueio enquanto vale
  - **desbloquear** até uma data, com o motivo registrado
  - **ler os detalhes:** plano, situação, datas, profissionais ativos, ids no Mercado Pago e histórico de cobranças
  - **avisos por e-mail que falharam:** os de `billing_notices` com `status = 'failed'` (esgotaram as tentativas, ou o Resend recusou), com o motivo em `detail`, para o Proprietário perceber uma chave do Resend vencida ou um domínio sem verificação antes de o cliente reclamar (ticket 08)
- Desbloquear e dar cortesia não criam nem alteram nada no Mercado Pago.
- A tela Admin > Tenants ganha a coluna de situação e uma visão de detalhe com essas ações, cada uma com confirmação.
- O `CONTEXT.md` ganha o termo Cortesia.

**Blocked by:** 03 (Período de teste, Estado de Acesso e bloqueio do painel), 05 (Assinar pelo Mercado Pago, 05a)

**Status:** ready-for-agent

- [ ] pgTAP: cada função funciona para o Proprietário e é recusada para Gerente, Barbeiro, anônimo e Gerente com `tenant_id` nulo
- [ ] pgTAP: estender o teste e desbloquear mudam o Estado de Acesso; a cortesia não bloqueia enquanto vale e segue a regra do teste vencido depois do fim
- [ ] Teste do front: a lista mostra a situação; o detalhe mostra os dados e executa as ações com confirmação
- [ ] `npm run lint`, `npm test` e `npm run build` passam
