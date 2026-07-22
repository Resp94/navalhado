# 01 — Unificação da Tipagem de Domínio e Contrato de Adaptador

**What to build:** Renomear os tipos base de `Customer` para `Cliente` (mantendo termos como `cadastro_completo` e `token_acesso`), exportar o tipo de status `StatusFiltroCliente`, padronizar assinaturas dos métodos no contrato `IClienteAdapter` e atualizar as implementações `InMemoryClienteAdapter` e `SupabaseClienteAdapter`.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Interface `Cliente` e `ClienteInputData` substitui totalmente o uso de `Customer` em `types.ts`
- [x] Tipo `StatusFiltroCliente = 'todos' | 'completos' | 'provisorios'` exportado formalmente
- [x] Métodos do contrato `IClienteAdapter` utilizam tipos do domínio unificados
- [x] Adaptadores `InMemoryClienteAdapter` e `SupabaseClienteAdapter` atualizados
- [x] Testes unitários compilando e passando limpos
