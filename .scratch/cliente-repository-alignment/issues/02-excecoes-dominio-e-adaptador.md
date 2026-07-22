# 02 — Exceções de Domínio Tipadas (ClienteConstraintError) e Resolução no Adaptador

**What to build:** Implementar a classe de erro de domínio `ClienteConstraintError` no `ClienteRepository`, capturar violações de integridade relacional SQL no repositório e convertê-las em exceção legível de domínio, adicionar a checagem `if (error) throw error` no método `fetchAppointmentHistory` do `SupabaseClienteAdapter`, e remover métodos utilitários de UI do repositório de domínio.

**Blocked by:** 01 — Unificação da Tipagem de Domínio e Contrato de Adaptador

**Status:** done

- [x] Classe `ClienteConstraintError` criada e exportada do módulo `clientes`
- [x] `ClienteRepository` trata erros de exclusão/alteração violada lançando `ClienteConstraintError`
- [x] Método `fetchAppointmentHistory` no `SupabaseClienteAdapter` lança exceção em caso de erro na query Supabase
- [x] Métodos auxiliares de UI desnecessários removidos do `ClienteRepository`
- [x] Testes unitários do repositório (`ClienteRepository.test.ts`) cobrem os novos fluxos de exceção de domínio
