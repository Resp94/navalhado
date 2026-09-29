# 14: Exportar dados

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** o Gerente baixa os dados da barbearia a qualquer momento, inclusive bloqueado. Os dados nunca ficam presos ao Navalhado.

- O botão "Exportar dados" aparece na tela de bloqueio do Gerente e na tela Assinatura.
- O arquivo reúne, em CSV, os clientes, os agendamentos e as comandas do tenant, lidos com as permissões do próprio Gerente.
- A leitura continua permitida com a barbearia bloqueada, porque o bloqueio do painel é só no front.
- Só o Gerente exporta. O Barbeiro não vê o botão.

**Blocked by:** 03 (Período de teste, Estado de Acesso e bloqueio do painel), 06 (Tela Assinatura e histórico de cobranças, 05b)

**Status:** ready-for-agent

- [ ] Teste do módulo: gera os três CSV com os dados do próprio tenant, cabeçalho e acentos corretos
- [ ] Teste do front: o botão aparece para o Gerente na tela de bloqueio e na tela Assinatura, e não aparece para o Barbeiro
- [ ] Conferido no DEV: um tenant bloqueado exporta os três arquivos
- [ ] `npm run lint`, `npm test` e `npm run build` passam
