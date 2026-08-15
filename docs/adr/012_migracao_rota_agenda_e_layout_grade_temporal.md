# ADR 012: Migração da Rota Canônica do Gerente para /agenda e Layout em Grade Temporal

## Status

Aceita em 2026-08-15.

## Contexto

Anteriormente, o sistema utilizava a rota `/dashboard` para a tela principal do Gerente da barbearia. No entanto:
1. No modelo de domínio de barbearias, o foco operacional primário não é um painel analítico de relatórios ("dashboard"), mas sim o controle em tempo real dos atendimentos do dia ("agenda").
2. A rota `/admin/dashboard` é reservada exclusivamente para a visão global do Proprietário (SaaS Admin).
3. A interface anterior da agenda utilizava cartões empilhados verticalmente por profissional, sem uma régua contínua de slots de tempo, impedindo que o Gerente visualizasse o tempo ocioso entre atendimentos, a linha do tempo atual ou clicasse diretamente em horários livres para realizar agendamentos rápidos.

A partir da engenharia reversa do AppBarber ([docs/scraping_appbarber_agenda.md](file:///c:/Projetos/navalhado/docs/scraping_appbarber_agenda.md)), desenhou-se um novo padrão de layout e arquitetura para a agenda do Navalhado.

## Decisão

1. **Rota Canônica e Redirecionamentos:**
   - A rota operacional principal do Gerente passa a ser `/agenda` (`src/pages/gerente/Agenda.tsx`).
   - Requisições legadas para `/dashboard` no contexto do Gerente são redirecionadas automaticamente para `/agenda`.
   - O `GerenteLayout.tsx`, `AuthGuard.tsx`, `Login.tsx` e `OnboardingWizard.tsx` são atualizados para apontar para `/agenda`.

2. **Estrutura de Grade Temporal Contínua:**
   - Visualização por colunas de profissionais (`resourceDay`), onde o eixo vertical representa a régua de horários do dia (com slots de 15, 30, 45 e 60 minutos configuráveis).
   - A altura física de cada bloco de agendamento é proporcional à duração do serviço.
   - Indicador visual em tempo real ("Red Line") que marca o minuto atual sobre a grade.
   - Slots vazios tornam-se interativos: o clique em qualquer horário vago abre o modal de novo agendamento com barbeiro e hora preenchidos.

3. **Header de Controle Unificado:**
   - Botão mestre **`+ Encaixe`** em destaque cromático (`#795548` / terracota).
   - Navegador de datas com botões `< [Hoje] >` e exibição da data por extenso formatada em PT-BR.
   - Filtro de profissionais para exibição seletiva de colunas.

4. **Identidade Visual e Estados Semânticos dos Cards:**
   - Mapeamento de classes e cores por status:
     - Agendado Padrão (grafite/azul escuro).
     - Confirmado via WhatsApp (verde claro com ícone do WhatsApp).
     - Encaixe Rápido (marrom/laranja).
     - Em Atendimento / Faturado (azul/verde escuro).
     - Horário Bloqueado (vermelho/cinza - almoço ou folga).
   - Ações rápidas no card: Iniciar Atendimento, Cobrar/Faturar, WhatsApp Direto e Cancelar.

## Consequências

- A navegação e o glossário de domínio tornam-se 100% coesos com a operação real de barbearias.
- O componente `Dashboard.tsx` do Gerente é substituído pelo `Agenda.tsx` com arquitetura de grade temporal contínua.
- Os testes unitários e de integração de rotas e componentes passam a validar `/agenda`.
