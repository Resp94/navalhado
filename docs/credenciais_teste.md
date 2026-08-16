# 🔑 Credenciais e Usuários de Teste (Ambiente DEV)

Este documento registra as credenciais dos usuários e barbearias de teste utilizados para validação das rotas, fluxos operacionais e testes manuais no ambiente de desenvolvimento (`DEV`).

---

## 💈 Barbearia Modelo: Barbearia Teste Navalhado

* **Estabelecimento (Tenant):** `Barbearia Teste Navalhado`
* **Tenant ID:** `235ea034-3d30-4eaf-9af7-befd68040ad7`
* **Plano:** `Prata` (até 6 profissionais)
* **Fuso Horário:** `America/Sao_Paulo` (UTC-3)
* **Status do Onboarding:** Concluído (`onboarding_completed: true`)
* **Endereço:** Av. Paulista, 1000 - Bela Vista, São Paulo - SP (CEP: 01310-100)

### 👤 Usuário Gestor (Role: `gerente`)

| Campo | Valor |
| :--- | :--- |
| **Nome** | Jonathas Teste |
| **E-mail de Login** | `teste.gerente@navalhado.com.br` |
| **Senha** | `Teste@123456` |
| **Perfil/Role** | `gerente` |
| **Destino pós-login** | `/agenda` |

### ✂️ Profissionais Cadastrados na Escala

1. **Jonathas Teste (Gestor & Barbeiro Titular)**:
   - Comissão: 50%
   - Telefone: `(11) 99999-8888`
2. **Marcos Barbeiro (Barbeiro Parceiro)**:
   - Comissão: 50%
   - Telefone: `(11) 99999-0003`

### 📋 Serviços Configurados

* **Corte Tradicional**: R$ 45,00 (30 minutos)
* **Barba**: R$ 34,00 (30 minutos)
* **Corte e Barba**: R$ 72,00 (45 minutos)

---

## 👑 Administrador Geral SaaS (Role: `proprietario`)

| Campo | Valor |
| :--- | :--- |
| **E-mail de Login** | `aptus.fl@gmail.com` |
| **Perfil/Role** | `proprietario` / `gerente` |
| **Destino pós-login** | `/admin/dashboard` |

---

## 🧪 Cenários de Teste Operacionais (Spec 012)

### 1. Ciclo de Comandas & Sessão de Caixa
1. Acesse `/agenda` e clique em **"Cobrar"** em qualquer agendamento.
2. Caso o caixa do dia ainda não esteja aberto, o sistema exibe o **Modal de Abertura Assistida de Caixa** em overlay para informar o fundo de troco inicial (ex: `R$ 100,00`).
3. No **Modal de Checkout de Comanda**, adicione produtos (`+ Produto`) ou novos serviços (`+ Serviço`), configure descontos (% ou R$) e gorjeta do barbeiro.
4. Na seção de **Divisão de Pagamentos**, combine PIX, Cartão e Dinheiro (com calculadora de troco automática em dinheiro físico).
5. Clique em **"Finalizar & Receber"**: o agendamento muda reativamente para `completed` (verde `#0E9F6E`) e o estoque do produto sofre baixa automática.

### 2. Bloqueio de Horários na Grade
1. Na barra superior da `/agenda`, clique em **"+ Bloquear"**.
2. Selecione o profissional, o motivo (ex: `Almoço`, `Folga`), a data e o intervalo de horário.
3. O card com padrão listrado cinza (`.timeline-blocked-card`) é renderizado na coluna do profissional e esse período é subtraído automaticamente dos slots livres do Canal do Cliente.
4. Clique no card de bloqueio para desbloquear / remover o horário.

### 3. Encaixe Concorrente (Split 50%/50%)
1. Clique em **"+ Encaixe"** e crie um agendamento no mesmo horário de um cliente existente.
2. A grade posicionará ambos os cards lado a lado com largura de 50% / 50%, permitindo visualizar e interagir com ambos simultaneamente.

### 4. Lista de Espera Diária & Rodízio de Balcão
1. Clique em **"Espera"** no cabeçalho para abrir a gaveta lateral.
2. Cadastre um cliente que chegou ao balcão e aguarda vaga.
3. Ao surgir um cancelamento ou vaga, clique em **"Encaixar na Grade"**: o sistema sugere automaticamente o barbeiro com menos atendimentos no dia (algoritmo de rodízio de balcão balanceado) e abre o modal pré-preenchido.

---

> [!NOTE]
> Para testar o fluxo de agendamento em grade temporal (`/agenda`), faça login com `teste.gerente@navalhado.com.br` / `Teste@123456`.

