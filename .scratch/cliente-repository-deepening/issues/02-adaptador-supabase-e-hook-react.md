# 02 — Adaptador Supabase Concreto e Hook React `useClientes`

**What to build:**
Implementação do adaptador de produção `SupabaseClienteAdapter` que satisfaz a interface `IClienteAdapter` fazendo consultas SQL reais ao banco de dados do Supabase (`customers` e `appointments`). Construção do Custom Hook React `useClientes` que instancia o repositório, gerencia estados de carregamento (`loading`), tratamento de exceções de domínio e disparo de mensagens de notificação via Toast.

**Blocked by:** 01 — Contrato de Costura (`IClienteAdapter`) e Módulo Base `ClienteRepository`

**Status:** ready-for-agent

- [ ] `SupabaseClienteAdapter` criado realizando queries de clientes e join com agendamentos/serviços/barbeiros.
- [ ] Hook `useClientes` exportado para a camada de componentes React, fornecendo `customers`, `stats`, `loading`, `saveCustomer`, `deleteCustomer` e `fetchHistorico`.
- [ ] Integração com `useToast` garantindo que erros de validação exibam avisos amigáveis para o usuário.
