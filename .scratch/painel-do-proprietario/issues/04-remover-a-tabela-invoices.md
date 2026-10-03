# 04: Remover a tabela `public.invoices`

Parte da spec 054 (Painel do Proprietário).

**What to build:** sai do banco a tabela de faturas que nenhum código grava e que, depois do ticket 02, ninguém lê, junto com as policies e o índice dela. Ninguém mais consegue somar receita de uma tabela sem escritor.

**Blocked by:** 02 (Faturamento do mês e Evolução da receita vêm das cobranças aprovadas)

**Status:** ready-for-agent

- [ ] Busca no repositório (front, Edge Functions, migrations recentes e funções do banco no DEV) mostra que nada lê nem grava `invoices`
- [ ] Contagem de linhas só com leitura no DEV; na PROD, só com o OK explícito do usuário. Se alguma tiver linhas, o ticket para e volta ao usuário
- [ ] Migration aplicada só no DEV remove a tabela, as policies e o índice
- [ ] `docs/modelagem_banco.md` deixa de citar a tabela
- [ ] pgTAP da spec (o do ticket 02) prova que a tabela não existe mais (`hasnt_table`)
- [ ] Gates de lint, Vitest e build passam
