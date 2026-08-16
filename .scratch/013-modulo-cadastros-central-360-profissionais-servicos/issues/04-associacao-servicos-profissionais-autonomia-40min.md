# 04 — Associação Granular de Serviços e Autonomia de Duração do Barbeiro (40 min padrão)

**What to build:**
Implementar na tela `/profissionais` a gestão individual de serviços habilitados por profissional, permitindo que o próprio barbeiro ou o gerente personalize sua duração (com 40 min padrão) e comissão específica por serviço, refletindo automaticamente no cálculo de horários livres na agenda.

**Blocked by:** 01 — Migração de Banco Versionada 018 (Expansão de Clientes, Serviços e Produtos, Tabela N:N, Drop Payments e RLS Granular)

**Status:** ready-for-agent

- [ ] Criar adaptador e tipos no frontend para interagir com a tabela `public.professional_services`.
- [ ] Implementar modal na tela `/profissionais` exibindo a listagem de todos os serviços do estabelecimento com chaveadores (liga/desliga), duração customizada em minutos (com placeholder de 40 min padrão) e comissão específica (%).
- [ ] Adicionar botão de ação rápida *"Habilitar Todos os Serviços"* herdando os padrões do catálogo.
- [ ] Atualizar o motor de busca de horários disponíveis (`get_available_slots` / fluxo de agendamento) para calcular a grade com base no tempo customizado do profissional selecionado.
- [ ] Criar testes unitários para a associação N:N e cálculo de duração individual de profissionais.
- [ ] Realizar validação visual no navegador em `http://localhost:5173/profissionais`.
