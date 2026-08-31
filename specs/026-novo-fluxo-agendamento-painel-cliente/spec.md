# Spec 026 — Novo Fluxo de Agendamento Público, Painel do Cliente e Reagendamento

## Problem Statement

Atualmente, o fluxo público de agendamento e a gestão de horários do cliente no Navalhado utilizam uma interface monolítica de múltiplas etapas verticais na mesma página (FluxoAgendamento.tsx e MenuCliente.tsx), com cabeçalhos extensos, slogans e detalhes que poluem o topo mobile. Além disso, o acesso aos agendamentos anteriores era rotulado apenas como \ Histórico\ sem contexto acionável, e a visualização dos cortes passados não contava com uma linha do tempo intuitiva como a do Agenda Serviço, dificultando a navegação rápida e a remarcação de atendimentos em dispositivos móveis.

## Solution

Criar uma experiência moderna, mobile-first (390 x 844 px) e 100% aderente ao Design System do Navalhado (Warm Cream #FFF1E6, Roasted Espresso #2D231E, Mandarin Glow #D96C00, Emerald Green #0E9F6E e Double-Bezel), baseada nas 8 pranchas refinadas e validadas no Penpot:
1. **Catálogo de Serviços Limpo com Logo Real**: Topo minimalista utilizando o logotipo oficial do Navalhado disponível em /simbolo.svg (pasta public/) e apenas o nome da barbearia em tipografia Outfit, sem legendas ou slogans que poluam a tela.
2. **Cards de Serviço Fidedignos**: Exibição limpa de Nome do Serviço, Preço formatado em BRL e Duração estimada (minutos), baseados estritamente nos dados reais cadastrados no banco de dados, sem tags artificiais.
3. **Navegação em Modais Especializados**: Seleção de dias em grade 2x3, escolha de barbeiro e horários com slots claros, e resumo da comanda com identificação rápida via WhatsApp sem senha.
4. **Painel do Cliente com Abas Claras e Card Destaque Atual**: Preservação do banner escuro em gradiente para novos agendamentos no topo, com alternância entre Próximos horários e Anteriores.
5. **Histórico em Linha do Tempo Estilo Agenda Serviço**: Trilho vertical contínuo em tom âmbar #D96C00, marcadores de mês, ramificações de data (11/08, 10/08), cards de comanda e selos flutuantes de conclusão (✓).
6. **Fluxo de Remarcação Direta**: Clique em Remarcar valida lead time de 2h e abre diretamente o Modal 03 com o serviço e profissional pré-selecionados para rápida escolha de novo horário.
7. **Zero Emojis**: 100% de ícones vetoriais SVG da biblioteca Hugeicons Free (@hugeicons/core-free-icons).

## User Stories

1. Como cliente em um smartphone, quero visualizar o catálogo público da barbearia com um cabeçalho limpo contendo o logotipo oficial (/simbolo.svg) e o nome do estabelecimento, para que eu identifique o local e encontre os serviços rapidamente.
2. Como cliente, quero ver os serviços organizados em cards com nome, preço (R$) e duração em minutos, para entender o custo e tempo de cada atendimento.
3. Como cliente, quero filtrar os serviços pelas categorias reais cadastradas no estabelecimento (\Todos\, \Cabelo\, \Barba\), para encontrar exatamente o serviço desejado em 1 toque.
4. Como cliente, quero clicar em um serviço e visualizar imediatamente uma grade 2x3 com os próximos dias da semana, para escolher a data ideal sem precisar rolar calendários complexos.
5. Como cliente, quero poder navegar entre semanas através de botões de avanço e retrocesso, para agendar em datas futuras quando necessário.
6. Como cliente, ao selecionar um dia, quero ver a lista de barbeiros disponíveis e a grade de horários livres em 3 colunas, para escolher meu profissional de confiança ou optar por qualquer profissional livre.
7. Como cliente, quero que os horários passados ou fora da janela de antecedência mínima configurada pela barbearia sejam automaticamente ocultados, para que eu nunca selecione um horário inválido.
8. Como cliente, ao selecionar um horário, quero ver o resumo da comanda (serviço, barbeiro, data, hora e valor) acompanhado de campos para informar meu Nome e WhatsApp com DDD, para confirmar o agendamento em poucos segundos.
9. Como cliente, quero ser informado de que o pagamento é presencial no balcão da barbearia (PIX, crédito e débito), para não ter dúvidas sobre cobranças online.
10. Como cliente, quero que meus dados de identificação sejam salvos com segurança em sessão pública no meu dispositivo, para que eu possa gerenciar meus agendamentos sem precisar criar ou lembrar senhas.
11. Como cliente, quero acessar a aba \Meus agendamentos\ na barra inferior de navegação a qualquer momento, para consultar meus horários marcados.
12. Como cliente não autenticado, ao tocar em \Meus agendamentos\, quero informar meu Nome e WhatsApp em um modal rápido, para que o sistema localize instantaneamente meus agendamentos nesta barbearia.
13. Como cliente autenticado no painel, quero ver o banner de destaque atual no topo (\Precisa de um novo horário?\), para poder iniciar um novo agendamento com facilidade sempre que desejar.
14. Como cliente, quero alternar entre as abas \Próximos horários\ e \Anteriores\, para separar claramente o que ainda vai acontecer do meu histórico de cortes passados.
15. Como cliente na aba \Próximos horários\, quero ver meu agendamento confirmado com badge verde esmeralda, detalhes do barbeiro e botões diretos de \Remarcar\ e \Cancelar\.
16. Como cliente, quero clicar em \Remarcar\ no meu agendamento ativo e ser levado diretamente para a seleção de novo horário com meu serviço e barbeiro já preenchidos, para remarcar meu atendimento com agilidade máxima.
17. Como cliente, se eu tentar remarcar ou cancelar com menos de 2 horas de antecedência (lead-time expirado), quero receber um aviso amigável com botão para falar diretamente com a barbearia pelo WhatsApp.
18. Como cliente na aba \Anteriores\, quero visualizar meus atendimentos passados em formato de linha do tempo vertical com marcadores de mês, ramificações de data e selos verdes de conclusão, para ter uma visão nostálgica e clara de todos os serviços que já realizei.
19. Como cliente, ao clicar em \Cancelar\, quero visualizar um diálogo de confirmação com ícone de alerta, justificativa opcional e aviso claro de que o horário será liberado para outros clientes, para evitar cancelamentos acidentais.
20. Como cliente, quero clicar em \Sair\ no painel, para desconectar minha sessão com segurança no dispositivo.

## Implementation Decisions

- **Escopo 100% Front-End**: Nenhuma alteração de backend, RPCs do Supabase, triggers ou migrations de banco de dados será realizada. Todas as chamadas de repositório (canalClienteRepository) e contratos de dados permanecem idênticos.
- **Logotipo Oficial**: Utilização direta do arquivo vetorial /simbolo.svg (localizado em public/) renderizado dentro do cabeçalho limpo (CatalogoServicosHeader.tsx).
- **Módulos Desacoplados (codebase-design)**: Subdivisão em componentes especializados sob src/components/cliente/:
  - CatalogoServicosHeader.tsx: Logotipo oficial Navalhado (/simbolo.svg), nome da barbearia em Outfit font 900, sem slogans secundários.
  - ModalSelecaoDias.tsx: Modal double-bezel com grade 2x3 de dias da semana (ex: 31/08 · Segunda), setas de paginação de semana e feedback de seleção.
  - ModalSelecaoHorarios.tsx: Modal double-bezel com seletor de barbeiros em cards horizontais e grade de slots de horários em 3 colunas (#0E9F6E para selecionado). Suporta flag isRescheduling.
  - ModalResumoAgendamento.tsx: Modal de checkout com comanda detalhada, ícones Hugeicons, inputs de Nome/WhatsApp e badge de pagamento no balcão.
  - ModalIdentificacaoCliente.tsx: Modal de acesso direto para clientes que clicam em \Meus agendamentos\ na barra inferior.
  - BannerNovoAgendamento.tsx: Card destaque oficial escuro com gradiente linear-gradient(135deg, #1A120F 0%, #2E2018 50%, var(--color-brand-primary) 100%), círculo decorativo em mesh e botão pill com seta ArrowRight01Icon.
  - CardAgendamentoAtivo.tsx: Card de agendamento confirmado com badge esmeralda #0E9F6E, ícones Calendar02Icon, UserIcon, botão Remarcar com RefreshIcon e Cancelar com Cancel01Icon.
  - TimelineHistoricoAgendamentos.tsx: Linha do tempo vertical idêntica ao Agenda Serviço (trilho contínuo em tom âmbar #D96C00, marcadores circulares de mês, guias — 11/08 e selos flutuantes de status com Tick01Icon).
  - ModalCancelamentoAgendamento.tsx: Diálogo com AlertCircleIcon, motivo opcional e validação de lead-time.
  - ClienteBottomNav.tsx: Floating bottom navigation bar com abas Agendar (Calendar02Icon) e Meus agendamentos (Scissors01Icon).
- **Vercel React Best Practices (ercel-react-best-practices)**:
  - Derivação de estado pura sem efeitos (erender-derived-state-no-effect).
  - Proibição de componentes declarados dentro de outros componentes (erender-no-inline-components).
  - Carregamento assíncrono em paralelo (sync-parallel).
- **Microcopy e Estilo**:
  - Sentence case estrito para todos os títulos e CTAs.
  - Ausência de travessões no meio de textos explicativos.
  - Zero emojis em código ou telas; 100% @hugeicons/core-free-icons.

## Testing Decisions

- A validação comportamental será executada através de testes unitários e de integração com React Testing Library nos arquivos src/pages/cliente/__tests__/FluxoAgendamento.test.tsx e src/pages/cliente/__tests__/MenuCliente.test.tsx.
- Cobertura de testes:
  - Renderização limpa do catálogo de serviços com o logotipo /simbolo.svg e filtro por categoria real.
  - Abertura sequencial dos modais de Dias, Barbeiro/Horários e Resumo.
  - Validação de formulário (nome composto e telefone com DDD).
  - Fluxo de reagendamento direto a partir do card ativo.
  - Alternância entre abas no Painel do Cliente e exibição da linha do tempo histórica.
  - Fluxos de cancelamento com e sem justificativa e verificação da mensagem de antecedência mínima.

## Out of Scope

- Alterações no schema do banco de dados PostgreSQL ou novas tabelas Supabase.
- Modificação nas RPCs existentes do banco de dados (consultar_grade_horarios_publica, iniciar_sessao_publica_cliente, eagendar_agendamento_publico_sessao, etc.).
- Alterações no painel do barbeiro ou painel administrativo do gerente.
- Pagamentos online ou gateway de pagamento (pagamento permanece presencial).
