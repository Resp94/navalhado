# Personas e Histórias de Usuário (User Stories) - Navalhado

Este documento detalha os perfis de usuários (personas) que interagem com o sistema **Navalhado** e as respectivas histórias de usuário que direcionam o desenvolvimento das funcionalidades e controles de acesso.

---

## 👥 Resumo das Personas

| Persona | Tipo de Acesso | Escopo de Acesso | Canal de Interação |
| :--- | :--- | :--- | :--- |
| **Proprietário** | Admin Geral (SaaS) | Global (Todos os Tenants) | Painel Web Administrativo |
| **Gerente de Barbearia** | Admin do Tenant | Exclusivo da Barbearia | Painel Web de Gestão |
| **Barbeiro** | Profissional (Staff) | Agenda e Comissões Próprias | Painel Web / Mobile do Profissional |
| **Cliente** | Usuário Externo (Final) | Agendamento Próprio | Web App Sem Login (via link WhatsApp) |

---

## 👑 1. Proprietário (SaaS Admin)

O **Proprietário** é o administrador geral do SaaS. Seu foco principal é a saúde financeira do negócio, o gerenciamento de assinaturas das barbearias e a manutenção da infraestrutura de integração (Evolution API).

### Objetivos Principais
- Monitorar a receita recorrente mensal (MRR).
- Gerenciar o ciclo de vida das barbearias contratantes (tenants).
- Controlar a adimplência e o status das assinaturas.

### Histórias de Usuário (User Stories)

*   **US01 - Gestão de Tenants:**
    *   *Como* Proprietário do SaaS,
    *   *eu quero* gerenciar o status das barbearias cadastradas (Ativar, Suspender ou Bloquear por inadimplência),
    *   *para que* eu mantenha o controle financeiro sobre os assinantes ativos do sistema.
*   **US02 - Dashboard Analítico:**
    *   *Como* Proprietário do SaaS,
    *   *eu quero* visualizar um dashboard consolidado contendo MRR, número de barbearias ativas/suspensas e receita mensal,
    *   *para que* eu possa tomar decisões estratégicas de crescimento da plataforma.
*   **US03 - Monitoramento de Integrações:**
    *   *Como* Proprietário do SaaS,
    *   *eu quero* acompanhar o status da conexão WhatsApp (instâncias da Evolution API) de cada barbearia cadastrada,
    *   *para que* eu possa garantir a alta disponibilidade da automação de agendamentos.
*   **US04 - Exportação de Relatórios:**
    *   *Como* Proprietário do SaaS,
    *   *eu quero* exportar relatórios financeiros consolidados de faturamento do SaaS (assinaturas pagas, pendentes e canceladas),
    *   *para que* eu possa realizar análises contábeis e de desempenho do negócio.

---

## 📋 2. Gerente de Barbearia (Tenant Admin)

O **Gerente de Barbearia** é o administrador local de um tenant específico. Ele gerencia a operação diária da barbearia, configura serviços, escala da equipe, visualiza o financeiro e gerencia a integração com o WhatsApp para envio de mensagens automáticas aos seus clientes.

### Objetivos Principais
- Cadastrar e gerenciar serviços, profissionais e escalas.
- Monitorar o faturamento diário e mensal da barbearia.
- Controlar o pagamento de comissões aos profissionais.
- Manter o canal do WhatsApp conectado e operando corretamente.

### Histórias de Usuário (User Stories)

*   **US05 - Gestão de Profissionais e Serviços:**
    *   *Como* Gerente de Barbearia,
    *   *eu quero* cadastrar e editar profissionais, seus horários de escala e os serviços oferecidos com seus respectivos preços, durações e categorias,
    *   *para que* a equipe esteja organizada e os serviços estejam disponíveis para agendamento.
*   **US06 - Criação de Acessos para Equipe:**
    *   *Como* Gerente de Barbearia,
    *   *eu quero* cadastrar as credenciais de acesso de cada barbeiro associando seus respectivos perfis e permissões,
    *   *para que* os barbeiros acessem o sistema de forma segura para gerenciar suas próprias agendas.
*   **US07 - Relatório Financeiro do Estabelecimento:**
    *   *Como* Gerente de Barbearia,
    *   *eu quero* acessar um painel financeiro com faturamento bruto por tipo de pagamento (Dinheiro, PIX, Cartão) e faturamento líquido, com filtro por período,
    *   *para que* eu consiga monitorar a saúde financeira da minha barbearia.
*   **US08 - Controle e Fechamento de Comissões:**
    *   *Como* Gerente de Barbearia,
    *   *eu quero* visualizar uma tabela consolidada com as comissões calculadas por barbeiro com base nos serviços realizados,
    *   *para que* eu realize os pagamentos da equipe de forma precisa e transparente.
*   **US09 - Configuração da Evolution API:**
    *   *Como* Gerente de Barbearia,
    *   *eu quero* gerar uma nova instância da Evolution API e escanear o QR Code para conectar o WhatsApp da barbearia,
    *   *para que* o sistema possa disparar mensagens automáticas de agendamento e cancelamento.
*   **US10 - Painel da Agenda Diária:**
    *   *Como* Gerente de Barbearia,
    *   *eu quero* visualizar a agenda diária consolidada de todos os profissionais com opção de agendamento manual,
    *   *para que* eu consiga apoiar no fluxo de atendimento de clientes que chegam sem agendamento prévio.

---

## ✂️ 3. Barbeiro (Professional / Staff)

O **Barbeiro** é o profissional técnico que realiza os atendimentos. Ele utiliza o sistema de forma restrita, focada na visualização da sua agenda, conclusão de serviços e acompanhamento das suas comissões.

### Objetivos Principais
- Consultar os atendimentos agendados para ele no dia.
- Concluir atendimentos e registrar a forma de pagamento do cliente.
- Acompanhar de forma transparente seus ganhos e comissões acumuladas.

### Histórias de Usuário (User Stories)

*   **US11 - Minha Agenda Diária:**
    *   *Como* Barbeiro,
    *   *eu quero* consultar minha agenda de atendimentos filtrada por dia ou semana,
    *   *para que* eu saiba quais clientes atenderei e em quais horários.
*   **US12 - Finalização e Lançamento de Atendimento:**
    *   *Como* Barbeiro,
    *   *eu quero* marcar um atendimento como concluído no sistema e registrar a forma de pagamento utilizada pelo cliente (Dinheiro, PIX ou Cartão),
    *   *para que* o financeiro seja atualizado e a comissão seja gerada no caixa.
*   **US13 - Acompanhamento de Comissões:**
    *   *Como* Barbeiro,
    *   *eu quero* visualizar um relatório simples de minhas comissões acumuladas por período (dia, semana ou mês),
    *   *para que* eu tenha controle e transparência sobre meus ganhos.

---

## 📱 4. Cliente (End User / Consumer)

O **Cliente** é o usuário final externo. Ele acessa uma interface web simplificada, otimizada para dispositivos móveis, sem a necessidade de criar login/senha convencionais. Ele é identificado por um link único contendo um token seguro e temporário enviado via WhatsApp.

### Objetivos Principais
- Realizar agendamentos rápidos de forma autônoma.
- Reagendar ou cancelar horários previamente agendados.
- Receber notificações e confirmações diretamente no seu WhatsApp.

### Histórias de Usuário (User Stories)

*   **US14 - Fluxo de Agendamento Autônomo:**
    *   *Como* Cliente,
    *   *eu quero* acessar o link temporário de agendamento, selecionar o serviço desejado, escolher o profissional de minha preferência e selecionar um horário disponível,
    *   *para que* eu possa garantir meu atendimento sem precisar ligar ou trocar várias mensagens de texto.
*   **US15 - Gestão de Horários Marcados:**
    *   *Como* Cliente,
    *   *eu quero* acessar meu menu de agendamentos e ter a opção de reagendar ou cancelar um horário futuro,
    *   *para que* eu consiga gerenciar meus compromissos caso surjam imprevistos.
*   **US16 - Confirmação Instantânea:**
    *   *Como* Cliente,
    *   *eu quero* receber mensagens automáticas no WhatsApp confirmando meu agendamento, lembrando-me do horário ou notificando o cancelamento do mesmo,
    *   *para que* eu tenha certeza de que a reserva foi efetivada e não me esqueça do compromisso.
