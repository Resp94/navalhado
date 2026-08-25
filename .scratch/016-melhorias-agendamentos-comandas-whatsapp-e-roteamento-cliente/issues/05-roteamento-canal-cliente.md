# 05 — Roteamento Inteligente do Canal do Cliente (Novo vs Frequente)

**What to build:** 
Ajustar as regras de acesso e redirecionamento do canal do cliente:
1. Clientes sem cadastro completo (`!cadastro_completo` ou acessando via link curto novo) devem visualizar diretamente a tela de seleção de serviços (Etapa 1 do fluxo de agendamento).
2. Clientes com cadastro completo (`cadastro_completo === true`), independentemente do link que utilizarem para acessar, devem ser direcionados automaticamente para a sua página de gerenciamento de agendamentos (`MenuCliente`), visualizando seus agendamentos ativos, histórico e o botão de destaque "Agendar novo horário".
3. Ao clicar em "Agendar novo horário" no painel, o cliente deve navegar para o fluxo de agendamento sem sofrer redirecionamento em loop e, ao finalizar a reserva, retornar ao painel com seu agendamento confirmado.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Ajustar o `MenuCliente.tsx` para redirecionar clientes com `cadastro_completo === false` imediatamente para `/cliente/agendar`.
- [ ] Ajustar o `FluxoAgendamento.tsx` para redirecionar clientes com `cadastro_completo === true` para `/cliente/menu` caso não tenham vindo de uma ação explícita de novo agendamento (`fromMenu`).
- [ ] Conectar o botão "Agendar novo horário" do `MenuCliente.tsx` para enviar o estado de intenção de agendamento explícito.
- [ ] Criar/atualizar testes automatizados em `MenuCliente.test.tsx` e `FluxoAgendamento.test.tsx` validando os fluxos de clientes novos e cadastrados.
