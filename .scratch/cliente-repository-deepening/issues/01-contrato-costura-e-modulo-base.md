# 01 — Contrato de Costura (`IClienteAdapter`) e Módulo Base `ClienteRepository`

**What to build:**
Definição do contrato de costura (`IClienteAdapter`), das interfaces de tipos de cliente (`Customer`, `CustomerInputData`, `CustomerAppointmentHistory`), do adaptador em memória (`InMemoryClienteAdapter`) e da implementação da classe profunda `ClienteRepository`. O módulo permite consultar clientes por tenant, salvar clientes (promovendo automaticamente de provisório para completo ao editar), excluir clientes e listar o histórico de visitas agregando agendamentos.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Interface `IClienteAdapter` definida com suporte a operações por tenant e histórico de visitas.
- [ ] Adaptador `InMemoryClienteAdapter` construído com dados falsos determinísticos para testes.
- [ ] Módulo `ClienteRepository` implementado encapsulando ordenação por nome e lógica de promoção de cadastro completo.
- [ ] Suíte de testes unitários em `src/modules/clientes/__tests__/ClienteRepository.test.ts` rodando e passando 100% em verde.
