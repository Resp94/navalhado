# 02 — Módulo Profundo CanalClienteRepository e Adaptador em Memória com Testes

**What to build:** A implementação do módulo profundo `CanalClienteRepository` com a regra de negócio completa de validações, resolução de token e tratamento de fluxo, acompanhada do `InMemoryCanalClienteAdapter` e de uma suíte de testes unitários automatizados validando 100% das regras em memória.

**Blocked by:** 01 — Contratos de Tipos e Erros de Domínio do Canal do Cliente.

**Status:** completed

- [x] Implementação da classe `CanalClienteRepository` operando sobre qualquer `ICanalClienteAdapter`.
- [x] Validações de obrigatoriedade de campos e regras de separação entre agendamentos ativos e histórico.
- [x] Implementação da classe `InMemoryCanalClienteAdapter` para execução de testes em memória sem banco de dados.
- [x] Suíte de testes automatizados em `__tests__/CanalClienteRepository.test.ts` cobrindo sucesso, erros de validação, conflitos de horário e regras de cancelamento.

