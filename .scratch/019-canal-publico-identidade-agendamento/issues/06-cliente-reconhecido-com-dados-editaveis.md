# 06 — Cliente reconhecido com dados editáveis

**What to build:** Quando houver um token válido, o formulário público vem preenchido, mas permite alterar os dados para agendar para outra pessoa sem sobrescrever indevidamente o cliente original.

**Blocked by:** 01 — Contexto público sem criação automática de cliente; 05 — Confirmação pública transacional com identidade correta.

**Status:** ready-for-agent

- [ ] Token válido é validado contra tenant e cadastro completo antes de preencher o formulário.
- [ ] Nome e telefone reconhecidos aparecem preenchidos e permanecem editáveis.
- [ ] Alteração para outro telefone preserva o cliente original e usa ou cria a identidade do novo telefone.
- [ ] Mesmo telefone mantém a identidade da pessoa já cadastrada, aplicando a regra definida para o nome existente.
- [ ] Token inválido, expirado ou pertencente a outro tenant não concede acesso ao cadastro.
- [ ] O armazenamento local possui versão/schema compatível e não reutiliza tokens legados de forma insegura.
- [ ] Existem testes para primeiro acesso, retorno reconhecido, edição da própria identidade e agendamento para terceiro.
