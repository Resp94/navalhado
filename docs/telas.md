# Interfaces de Usuário (Telas e Modais) - Navalhado

Este documento detalha o design conceitual, componentes de interface, estados de interação e comportamento das telas e modais da aplicação **Navalhado**. Com base na nossa estratégia de otimização de UX (SPA), consolidamos as 16 telas originais em **13 rotas de página inteira** enriquecidas com **modais contextuais**, melhorando a fluidez da navegação.

---

## 🗺️ Visão Geral da Arquitetura de Interface

A interface é dividida em quatro grandes áreas (SaaS Geral, Proprietário, Estabelecimento/Gerente, Barbeiro/Staff e Cliente). A tabela abaixo classifica cada item em **Página Inteira (Tela)** ou **Modal / Drawer (Gaveta Deslizante)**.

| Rota / Origem | Nome da Interface | Tipo de Interface | Contexto de Exibição |
| :--- | :--- | :--- | :--- |
| `/` | Login Geral Inteligente | Página Inteira (Tela) | Raiz do sistema |
| `/signup` | Cadastro de Barbearia (Onboarding) | Página Inteira (Tela) | Criação de novos Tenants |
| `/reset-password` | Redefinição de Senha | Página Inteira (Tela) | Recuperação via token |
| `/admin/dashboard` | Dashboard do SaaS | Página Inteira (Tela) | Área Administrativa Global |
| `/admin/tenants` | Gestão de Barbearias | Página Inteira (Tela) | Tabela e filtros globais |
| `--> /admin/tenants` | Alterar Status (Ativar/Suspender) | **Modal** | Confirmação de status do tenant |
| `/dashboard` | Painel da Barbearia (Agenda Geral) | Página Inteira (Tela) | Área do Gerente |
| `--> /dashboard` | Novo Agendamento (Manual / Encaixe)| **Modal** | Agendamento rápido de balcão |
| `--> /dashboard` | Detalhes e Status do Agendamento | **Drawer (Lateral)** | Detalhes de um horário reservado |
| `/financeiro` | Relatório Financeiro & Comissões | Página Inteira (Tela) | Área do Gerente |
| `/profissionais` | Equipe, Serviços e Escalas | Página Inteira (Tela) | Área do Gerente |
| `--> /profissionais` | Cadastrar Acesso do Profissional | **Modal** | Emissão de credenciais para barbeiro |
| `--> /profissionais` | Cadastrar/Editar Serviço | **Drawer (Lateral)** | Adicionar serviços e comissões |
| `/whatsapp` | Conectividade Evolution API | Página Inteira (Tela) | Área do Gerente |
| `/minha-agenda` | Minha Agenda (Individual) | Página Inteira (Tela) | Área do Barbeiro |
| `--> /minha-agenda` | Finalizar e Cobrar Atendimento | **Modal** | Fechamento de caixa do barbeiro |
| `/minhas-comissoes` | Relatório de Ganhos Pessoais | Página Inteira (Tela) | Área do Barbeiro |
| `/cliente/:token` | Menu Principal do Cliente | Página Inteira (Tela) | Área do Cliente |
| `--> /cliente/:token` | Cancelar Agendamento Futuro | **Modal** | Confirmação e motivo de cancelamento |
| `/cliente/:token/agendar`| Fluxo de Agendamento | Página Inteira (Tela) | Passos 1, 2 e 3 (Foco Mobile) |

---

## 🚪 1. Interfaces de Autenticação e Onboarding

### Rota `/` | Login Geral Inteligente
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Autenticar qualquer usuário e redirecioná-lo automaticamente baseado na sua `role` (`proprietario` -> `/admin/dashboard`, `gerente` -> `/dashboard`, `barbeiro` -> `/minha-agenda`).
*   **Componentes de UI:**
    *   Formulário centralizado com logo do Navalhado.
    *   Campos de entrada: E-mail e Senha (com botão de exibir/ocultar senha).
    *   Botão "Entrar" (estado ativo e estado de carregamento com *spinner*).
    *   Links secundários: "Criar Conta da Barbearia" (redireciona para `/signup`) e "Esqueci minha senha" (abre modal de envio de e-mail de recuperação).

### Rota `/signup` | Cadastro de Barbearia (Onboarding)
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Cadastrar o tenant (`tenants`) e o perfil administrativo local (`users` com role `gerente`) em um único fluxo.
*   **Componentes de UI:**
    *   Formulário dividido em duas etapas visuais (Semântica de Passos):
        1.  *Dados da Barbearia:* Nome Comercial, E-mail corporativo, WhatsApp de Contato.
        2.  *Dados de Acesso & Plano:* Senha do Gerente, Seleção de Plano (cartões interativos com preço e limite de profissionais).
    *   Botão de envio "Criar Barbearia & Entrar" e link "Voltar ao Login".

### Rota `/reset-password` | Redefinição de Senha
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Permitir que o usuário digite e confirme sua nova senha de acesso após clicar no link do e-mail.
*   **Componentes de UI:**
    *   Campo de Nova Senha e Confirmação de Senha com validação de força de senha em tempo real.
    *   Botão "Atualizar Senha".

---

## 👑 2. Interfaces do Proprietário (SaaS Admin)

### Rota `/admin/dashboard` | Dashboard do SaaS
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Exibir indicadores macro da plataforma para o dono do SaaS.
*   **Componentes de UI:**
    *   Cartões de métricas rápidas: MRR (Receita Recorrente Mensal), Total de Barbearias Ativas, Barbearias Suspensas, Receita Bruta do Mês.
    *   Gráfico de linha mostrando a evolução da receita nos últimos 12 meses.
    *   Atalhos rápidos para a listagem de tenants.

### Rota `/admin/tenants` | Gestão de Barbearias
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Listar todas as barbearias cadastradas, verificar o status de conexão com o WhatsApp e alterar o status da assinatura de cada uma.
*   **Componentes de UI:**
    *   Barra de pesquisa inteligente (busca por nome da barbearia, e-mail ou telefone).
    *   Tabela principal: Nome, Proprietário, Plano Ativo, Status do WhatsApp (Conectado/Desconectado), Status da Assinatura (Ativo, Suspenso, Bloqueado) e coluna de Ações.
    *   **Modal de Alteração de Status (Ação rápida):**
        *   Ao clicar em "Ativar", "Suspender" ou "Bloquear", abre-se um modal de confirmação explicando o impacto da ação (ex: *"Bloquear esta barbearia impedirá que barbeiros e clientes acessem a agenda"*). Contém botão de confirmação e botão de cancelamento.

---

## 📋 3. Interfaces do Gerente (Tenant Admin)

### Rota `/dashboard` | Painel da Barbearia (Agenda Geral)
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Exibir a agenda geral da barbearia, permitindo controle diário de todos os barbeiros em uma única visualização.
*   **Componentes de UI:**
    *   Barra superior com resumo de hoje (Total de Agendamentos, Faturamento Previsto, Atendimentos Concluídos).
    *   Grade de horários dividida em colunas (uma coluna por barbeiro ativo).
    *   Botão de "Novo Agendamento".
    *   **Modal de Novo Agendamento Manual (Encaixe de balcão):**
        *   Formulário rápido contendo: Seleção do Cliente (busca por telefone ou input de novo cliente), Seleção do Profissional, Seleção do Serviço, Data e Horário. Botão "Reservar".
    *   **Drawer Lateral de Detalhes do Agendamento:**
        *   Ao clicar em um agendamento na grade, abre-se uma barra lateral contendo informações completas do atendimento (Cliente, Horário, Serviço, Status de Pagamento, Histórico). Permite alterar o status para "Cancelado" ou "Confirmado".

### Rota `/financeiro` | Relatórios e Comissões
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Apresentar a prestação de contas financeira do estabelecimento e calcular comissões de forma automatizada.
*   **Componentes de UI:**
    *   Seletor de Período (filtros rápidos: Hoje, Semana, Mês ou Intervalo Customizado).
    *   Blocos de faturamento: Faturamento Bruto total, Faturamento em Dinheiro, PIX e Cartão de Crédito/Débito.
    *   Faturamento Líquido (descontando as comissões).
    *   Tabela de Comissões por Barbeiro: Nome do Barbeiro, Total de Atendimentos, Faturamento Gerado, Comissão Acumulada no Período, Status de Repasse e Ação de "Registrar Pagamento de Comissão".
    *   Botão de exportação rápida para CSV/PDF.

### Rota `/profissionais` | Equipe, Serviços e Escalas
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Área unificada de recursos humanos e catálogo de serviços da barbearia.
*   **Componentes de UI:**
    *   Interface dividida em duas abas (Abas: "Barbeiros" e "Catálogo de Serviços").
    *   *Aba Barbeiros:* Lista cartões de profissionais ativos. Ao clicar em um profissional, abre painel de edição de escala semanal (com seletores de hora de início/fim para cada dia) e comissão padrão.
        *   **Modal de Cadastrar Acesso:** Formulário flutuante para registrar e-mail e senha do barbeiro no sistema, associando-o ao cadastro profissional.
    *   *Aba Catálogo de Serviços:* Lista de serviços ativos.
        *   **Drawer Lateral de Cadastro/Edição de Serviço:** Abre na lateral permitindo preencher Nome do Serviço, Descrição, Preço, Duração (em minutos), Categoria e Comissão Específica (caso difira da comissão geral do profissional).

### Rota `/whatsapp` | Conectividade Evolution API
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Conectar o número de WhatsApp corporativo do estabelecimento para disparos automáticos.
*   **Componentes de UI:**
    *   Status Card: Mostra se a instância está Conectada ou Desconectada.
    *   Painel do QR Code: Exibe o código gerado em tempo real pela Evolution API com instruções de pareamento.
    *   Botões de ação: "Gerar Nova Instância" (para forçar novo QR Code) e "Desconectar WhatsApp" (limpa a instância).

---

## ✂️ 4. Interfaces do Barbeiro (Staff)

### Rota `/minha-agenda` | Minha Agenda (Individual)
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Permitir que o profissional gerencie seus atendimentos de forma focada e rápida entre os cortes.
*   **Componentes de UI:**
    *   Visualização adaptada para telas móveis (Mobile-first).
    *   Filtro rápido de visualização (Dia Atual ou Semana).
    *   Lista vertical cronológica dos clientes do dia. Cada item exibe: Horário, Nome do Cliente, Nome do Serviço e Status.
    *   **Modal de Finalizar e Cobrar Atendimento:**
        *   Disparado ao clicar em "Finalizar" no atendimento atual.
        *   Exibe o valor total do serviço.
        *   Seletor de Forma de Pagamento (PIX, Dinheiro, Cartão).
        *   Botão "Confirmar Recebimento e Concluir". Fecha o modal e atualiza a agenda instantaneamente.

### Rota `/minhas-comissoes` | Relatório de Ganhos Pessoais
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Permitir que o barbeiro acompanhe seus ganhos acumulados sem precisar perguntar ao gerente.
*   **Componentes de UI:**
    *   Filtro de período rápido.
    *   Cartão em destaque: "Comissões Acumuladas no Período".
    *   Tabela com histórico detalhado: Data, Cliente, Serviço Realizado, Valor do Serviço, % de Comissão Aplicada, Valor Recebido em Comissão.

---

## 📱 5. Interfaces do Cliente (Acesso por Token no WhatsApp)

### Rota `/cliente/:token` | Menu Principal do Cliente
*   **Tipo:** Página Inteira (Tela - Totalmente responsiva para celular)
*   **Objetivo:** Central de controle do cliente, permitindo agendamento rápido sem senhas e controle de suas reservas ativas.
*   **Componentes de UI:**
    *   Cabeçalho personalizado com saudação (ex: *"Olá, Jonathas! Bem-vindo à Barbearia Estilo"*).
    *   *Se houver agendamento futuro ativo:*
        *   Exibe cartão de destaque com detalhes do agendamento (Data, Horário, Profissional, Serviço).
        *   Botões de Ação: "Reagendar" (redireciona para o fluxo de agendamento com os dados preenchidos) e "Cancelar Agendamento".
        *   **Modal de Cancelamento (Confirmação):** Alerta informando o cancelamento com campo opcional de motivo. Ao confirmar, o modal fecha, o status muda e uma mensagem de cancelamento é disparada.
    *   *Se não houver agendamentos futuros:*
        *   Exibe o botão de destaque "Agendar Novo Horário".

### Rota `/cliente/:token/agendar` | Fluxo de Agendamento (3 Passos)
*   **Tipo:** Página Inteira (Tela - Mobile-first)
*   **Objetivo:** Guiar o cliente de forma rápida e focada em 3 etapas para realizar uma reserva.
*   **Componentes de UI:**
    *   Barra de Progresso no topo (Passo 1: Serviço -> Passo 2: Barbeiro -> Passo 3: Horário).
    *   **Etapa 1 - Serviços:** Grade de serviços categorizados (Cabelo, Barba, Combos) com preço e duração. Botão "Próximo".
    *   **Etapa 2 - Profissionais:** Carrossel de fotos dos barbeiros com nome e avaliação. Botão "Próximo" ou opção "Tanto faz / Qualquer profissional".
    *   **Etapa 3 - Agenda e Horários:** Seletor de data em calendário simplificado e grade de chips de horários livres no dia selecionado.
    *   **Modal de Confirmação Final:**
        *   Exibe o resumo da reserva: *"Corte Masculino com Barbeiro João em 12/07 às 10:00"*.
        *   Botão "Confirmar Agendamento" (dispara a RPC no Supabase e aciona a notificação de confirmação no WhatsApp).
        *   Botão "Voltar" (para correções).
