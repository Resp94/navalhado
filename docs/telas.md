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
| `/agenda` | Painel da Barbearia (Agenda Geral) | Página Inteira (Tela) | Área do Gerente |
| `--> /agenda` | Novo Agendamento (Manual / Encaixe)| **Modal** | Agendamento rápido de balcão |
| `--> /agenda` | Receber Pagamento | **Modal** | Faturamento rápido do agendamento |
| `--> /agenda` | Cancelar Agendamento | **Modal** | Confirmação e justificativa de cancelamento |
| `/financeiro` | Relatório Financeiro & Comissões | Página Inteira (Tela) | Área do Gerente |
| `/profissionais` | Equipe, Serviços e Escalas | Página Inteira (Tela) | Área do Gerente |
| `--> /profissionais` | Cadastrar Acesso do Profissional | **Modal** | Emissão de credenciais para barbeiro |
| `--> /profissionais` | Cadastrar/Editar Serviço | **Drawer (Lateral)** | Adicionar serviços e comissões |
| `/whatsapp` | Conectividade da Instância WhatsApp | Página Inteira (Tela) | Área do Gerente |
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
*   **Objetivo:** Autenticar qualquer usuário e redirecioná-lo automaticamente baseado na sua `role` (`proprietario` -> `/admin/dashboard`, `gerente` -> `/agenda`, `barbeiro` -> `/minha-agenda`).
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
*   **Objetivo:** Painel de controle global do negócio (SaaS).
*   **Componentes de UI:**
    *   Cards de Métricas Chave: MRR Total, Novas Barbearias no Mês, Barbearias Ativas, Taxa de Churn.
    *   Gráficos: Tendência de Receita e Novas Adesões ao longo do tempo.
    *   Tabela de Atividades Recentes (novos cadastros, pagamentos de planos).

### Rota `/admin/tenants` | Gestão de Barbearias
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Listar todos os estabelecimentos cadastrados e gerenciar status operacional de cada tenant.
*   **Componentes de UI:**
    *   Tabela com: Nome do Estabelecimento, Responsável, E-mail, Plano Atual, Data de Cadastro, Status (Ativo, Pendente, Suspenso).
    *   Barra de busca por nome/email e filtros rápidos por status.
    *   **Modal de Alteração de Status:**
        *   Ação de "Suspender/Bloquear" ou "Reativar" barbearia com campo de justificativa.

---

## 📋 3. Interfaces do Gerente (Tenant Admin)

### Rota `/agenda` | Painel da Barbearia (Agenda Geral)
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Exibir a agenda geral da barbearia em grade temporal contínua com régua vertical de horários, linha do tempo em tempo real ("Red Line"), colunas individuais por barbeiro, agendamentos rápidos em slots vazios e botão mestre `+ Encaixe`. (A rota legada `/dashboard` redireciona automaticamente para `/agenda`).
*   **Componentes de UI:**
    *   **Barra Superior de Controle:** Data formatada por extenso em PT-BR, navegador temporal `< [Hoje] >`, seletor de data, filtro multiselect de profissionais e botão mestre **`+ Encaixe`** (`--color-brand-primary`).
    *   **Grade Temporal Contínua:** Eixo vertical de horários contínuos (08:00 às 20:00), colunas por barbeiro ativo (`resourceDay`), altura proporcional dos blocos à duração do serviço e Linha Vermelha de tempo real indicando a hora atual.
    *   **Cards de Agendamento Semânticos:** Badges de WhatsApp Confirmado, Encaixe de Balcão, Em Atendimento, Pago/Pendente e ações rápidas no card (WhatsApp direto, Iniciar Atendimento, Cobrar/Pago, Cancelar).
    *   **Modal de Novo Agendamento / Encaixe Rápido:** Alternância entre cliente existente e novo cliente (Nome + WhatsApp), seleção de profissional, serviço, horário, anotações (`notes`) e flag de encaixe (`is_fitting`).
    *   **Modal de Pagamento:** Confirmação do valor, escolha da forma de pagamento (PIX, Dinheiro, Cartão) e baixa financeira no agendamento.
    *   **Modal de Cancelamento:** Confirmação e justificativa do cancelamento.

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

### Rota `/whatsapp` | Conectividade da Instância WhatsApp
*   **Tipo:** Página Inteira (Tela)
*   **Objetivo:** Conectar o número de WhatsApp corporativo do estabelecimento para disparos automáticos.
*   **Componentes de UI:**
    *   Status Card: Mostra se a instância está Conectada ou Desconectada.
    *   Painel do QR Code: Exibe o código gerado em tempo real pela Uazapi, com instruções de pareamento.
    *   Botões de ação: **Ativar Integração do WhatsApp**, **Gerar QR Code de Conexão**, **Retomar Sessão** e **Desconectar Aparelho**. Desconectar encerra a sessão do aparelho, mas preserva o registro, as preferências e o token no backend; um novo QR Code será exigido para conectar outro aparelho.
    *   Estados visíveis: **Conectado**, **Pareando**, **Desconectado** e **Pausado**. “Desconectado” significa que não há sessão autenticada; “Pausado” significa que a sessão foi hibernada e pode ser retomada sem novo pareamento.

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
