# 01: Catálogo Tesoura, Máquina e Bancada

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** quem se cadastra no Navalhado vê e escolhe entre os planos novos, e a barbearia fica ligada ao plano escolhido.

| Plano | Profissionais | Preço mensal | Antes era |
|---|---|---|---|
| Tesoura | 1 | R$ 59,90 | Bronze |
| Máquina | 5 | R$ 89,90 | Prata |
| Bancada | 10 | R$ 159,90 | Ouro |

- Os planos são renomeados mantendo os UUIDs. As assinaturas existentes continuam apontando para o mesmo plano.
- A coluna de recursos do plano (`features`) sai: nenhum plano tem recurso a menos.
- A tela de cadastro deixa de ter os planos fixos no código e passa a ler o catálogo do banco, com o Máquina pré-selecionado.
- O cadastro passa a ligar o plano pelo identificador, e não mais pelo nome em minúsculas. Renomear um plano no futuro não quebra o cadastro.
- O Admin > Tenants e o onboarding mostram os nomes e preços novos.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Migration renomeia os três planos pelo UUID, com os preços e limites novos; nenhuma assinatura muda de plano
- [ ] Antes de remover `features`, conferido que nenhuma função, view ou tela a lê; a coluna é removida
- [ ] O cadastro lê o catálogo do banco, mostra nome, preço e limite de cada plano e vem com o Máquina marcado
- [ ] O cadastro grava a escolha pelo id do plano; a função que cria o tenant no cadastro liga o plano pelo id
- [ ] Teste de componente do cadastro: mostra os três planos vindos do banco e envia o id do plano escolhido
- [ ] Os testes atuais do cadastro e do onboarding continuam passando
- [ ] Conferido no DEV por consulta, antes e depois: os três planos renomeados e as assinaturas no mesmo UUID
- [ ] `npm run lint`, `npm test` e `npm run build` passam
