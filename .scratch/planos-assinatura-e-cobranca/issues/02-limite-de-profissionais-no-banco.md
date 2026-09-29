# 02: Limite de profissionais no banco e cota na tela

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** a barbearia não passa do número de profissionais ativos do seu plano, venha o cadastro de onde vier, e o Gerente vê quantas vagas ainda tem.

- Um gatilho em `professionals` recusa incluir um profissional ativo, e recusa reativar um profissional excluído, quando a barbearia já está no limite do plano da sua assinatura.
- Profissional ativo é o que não tem `deleted_at`. O Gerente conta só quando existe um profissional ativo vinculado a ele. Isso sai da própria contagem, sem regra especial.
- A recusa usa uma mensagem de erro própria.
- O onboarding e a tela de Profissionais mostram a cota ("3 de 5 profissionais") e traduzem o erro para uma mensagem amigável, com convite para subir de plano. Hoje o onboarding verifica o limite só no front; essa verificação passa a usar a mesma regra do banco.

**Blocked by:** 01 (Catálogo Tesoura, Máquina e Bancada)

**Status:** ready-for-agent

- [ ] pgTAP (numeração seguindo a maior existente, dentro de `begin; ... rollback;`):
  - cadastra até o limite e recusa o seguinte
  - reativar profissional excluído conta e é recusado no limite
  - o Gerente vinculado como profissional conta; o Gerente sem vínculo não conta
  - uma barbearia não é afetada pelo limite de outra
- [ ] Teste da tela de Profissionais: mostra a cota e a mensagem amigável quando o banco recusa por limite
- [ ] Teste do onboarding: mostra a cota e a mensagem amigável no limite
- [ ] Conferido no DEV: nenhum tenant existente fica acima do limite do seu plano; se algum ficar, fica registrado no resultado e nenhum profissional é desativado
- [ ] `npm run lint`, `npm test` e `npm run build` passam
