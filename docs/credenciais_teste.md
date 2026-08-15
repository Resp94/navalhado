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

> [!NOTE]
> Para testar o fluxo de agendamento em grade temporal (`/agenda`), faça login com `teste.gerente@navalhado.com.br` / `Teste@123456`.
