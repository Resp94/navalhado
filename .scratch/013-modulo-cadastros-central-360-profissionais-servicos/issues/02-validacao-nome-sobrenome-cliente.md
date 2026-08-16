# 02 — Validação Obrigatória de Nome e Sobrenome no Fluxo do Cliente

**What to build:**
Implementar e validar no fluxo público de agendamento e cadastro inicial a obrigatoriedade de informar Nome e Sobrenome (mínimo de 2 palavras), com mensagens amigáveis e bloqueio de envios inválidos.

**Blocked by:** 01 — Migração de Banco Versionada 018 (Expansão de Clientes, Serviços e Produtos, Tabela N:N, Drop Payments e RLS Granular)

**Status:** ready-for-agent

- [ ] Atualizar `CadastroInicialCliente.tsx` para exigir que o nome informado contenha ao menos duas palavras com mais de 1 caractere cada.
- [ ] Exibir mensagem de validação clara e contextualizada caso o cliente digite apenas o primeiro nome.
- [ ] Garantir que o envio para a RPC `complete_customer_registration` respeite o formato normalizado.
- [ ] Criar testes unitários para a validação de nome e sobrenome cobrindo casos válidos, nomes compostos e entradas inválidas.
- [ ] Realizar validação visual no navegador em `http://localhost:5173` simulando o fluxo de primeiro cadastro.
