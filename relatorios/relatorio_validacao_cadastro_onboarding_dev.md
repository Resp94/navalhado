# 📋 Relatório de Validação Visual, Onboarding e Persistência (Ambiente DEV)

* **Data da Execução:** 29 de Agosto de 2026
* **Ambiente Validado:** `https://dev.navalhado.com.br`
* **Banco de Dados (Supabase DEV):** `Navalhado-dev` (`selvxobcjbkligxighlp`)
* **Tipo de Validação:** Validação Visual End-to-End no Navegador (Chrome DevTools Automation) + Auditoria Direta via SQL no Postgres.

---

## 📌 1. Sumário Executivo

O fluxo completo de ponta a ponta (**Cadastro de Barbearia $\rightarrow$ Wizard de Onboarding de 4 Etapas $\rightarrow$ Acesso à Agenda Operacional**) foi executado com sucesso no ambiente `DEV`.

O sistema registrou o novo estabelecimento, criou o usuário autenticado com perfil `gerente`, salvou as configurações operacionais da barbearia, calculou sugestões de cardápio com base no valor base de corte, escalou a equipe inicial e liberou o acesso imediato à grade de agendamentos (`/agenda`).

Além do sucesso operacional básico, a auditoria detalhada de código e dados identificou **7 itens de não-conformidade / deferreds** entre frontend, backend e modelagem de dados que merecem atenção para a evolução do produto.

---

## 💈 2. Dados do Novo Tenant Criado para o Teste

* **Estabelecimento (Tenant):** `Barbearia Alpha Dev`
* **Tenant ID:** `4ccdee97-2918-4815-8a2a-b52811dcd9c7`
* **Plano:** `Prata` (ID: `b3fa7384-d113-4a1b-a5ed-1efeb7e51c22` - limite de 6 profissionais)
* **Status do Onboarding:** Concluído (`onboarding_completed: true`)
* **Endereço Informado:** Av. Paulista, 1500, Andar 12, Sala 1204 - Bela Vista, São Paulo - SP (CEP: `01310-100`)
* **Canal de Origem:** `Instagram`
* **Preço Base de Corte:** `R$ 50,00`

### 👤 Usuário Gestor (Role: `gerente`)

| Campo | Valor |
| :--- | :--- |
| **Nome** | Carlos Alpha Gestor |
| **E-mail de Login** | `gestor.alpha@navalhado.com.br` |
| **Senha** | `Senha@123456` |
| **User ID (Supabase Auth & users)** | `d6fc99a3-c3f0-4299-ac38-8120829e1320` |
| **Perfil/Role** | `gerente` |
| **Destino pós-login** | `/agenda` |

---

## 🚀 3. Relatório de Funcionalidades e Etapas do Fluxo

### 3.1. Tela de Cadastro (`/signup`)
* **Passo 1 (Dados da Barbearia):**
  - Campos: Nome Comercial, E-mail Comercial, WhatsApp de Contato.
  - Comportamento: Máscara automática de telefone funcional `(11) 98765-4321`.
  - Validação: Botão "Continuar" habilitado apenas com formulário válido.
* **Passo 2 (Acesso e Plano):**
  - Campos: Nome Completo do Gestor, E-mail de Login, Senha, Seleção de Plano (Bronze, Prata, Ouro).
  - Comportamento: Indicador reativo de força de senha exibiu "Forte" corretamente.
  - Submissão: Criação concorrente de Auth, Tenant, Usuário e Assinatura com estado de loading ("Criando..."). Redirecionamento automático para `/onboarding`.

### 3.2. Wizard de Onboarding (`/onboarding`)
* **Etapa 1 de 4 (Endereço):**
  - Entrada de CEP (`01310-100`) disparou busca assíncrona automática via ViaCEP.
  - Preenchimento instantâneo de Rua (`Avenida Paulista`), Bairro (`Bela Vista`), Cidade (`São Paulo`) e Estado (`SP`).
  - Preenchimento manual de Número (`1500`) e Complemento (`Andar 12, Sala 1204`).
* **Etapa 2 de 4 (Preço Base & Origem):**
  - Definição do valor de corte tradicional (`R$ 50,00`).
  - Seleção da origem de aquisição no combobox (`Instagram`).
  - Identificação visual correta do plano ativo ("Plano Prata - Limite de até 6 profissionais").
* **Etapa 3 de 4 (Cardápio de Serviços):**
  - Cálculo dinâmico das sugestões com base nos R$ 50,00 informados:
    - *Corte Tradicional*: R$ 50,00 • 30 min (já incluso por padrão).
    - *Barba*: R$ 38,00 • 30 min (adicionado via 1 clique).
    - *Corte e Barba*: R$ 80,00 • 45 min (adicionado via 1 clique).
  - Modal "Novo Serviço Personalizado" testado com sucesso: inclusão do serviço *Hidratação e Selagem* (R$ 60,00 • 45 min).
  - Teste de exclusão com o botão de lixeira: remoção e re-adição com atualização reativa da listagem.
* **Etapa 4 de 4 (Equipe e Barbeiros):**
  - Botão "Me incluir como Barbeiro": incluiu com 1 clique o gestor *Carlos Alpha Gestor* com 50% de comissão.
  - Cadastro de barbeiro adicional: inclusão de *Diego Barbeiro* com telefone `(11) 99887-7665` e 50% de comissão.
  - Contador de vagas do plano atualizado reativamente para "2 de 6 barbeiros cadastrados".
* **Conclusão:**
  - Botão "Concluir e Abrir meu Painel": gravação em lote de serviços, profissionais e dados do tenant.
  - Redirecionamento com sucesso para a rota `/agenda`.

---

## 🔍 4. Evidências de Persistência no Banco de Dados (Supabase DEV)

Todas as consultas abaixo foram validadas diretamente no banco de dados de desenvolvimento:

### 4.1. Tabela `public.tenants`
```json
{
  "id": "4ccdee97-2918-4815-8a2a-b52811dcd9c7",
  "name": "Barbearia Alpha Dev",
  "email": "alpha.dev@navalhado.com.br",
  "phone": "11987654321",
  "cep": "01310-100",
  "address_street": "Avenida Paulista",
  "address_number": "1500",
  "address_neighborhood": "Bela Vista",
  "address_city": "São Paulo",
  "address_state": "SP",
  "address": "Avenida Paulista, 1500 - Bela Vista, São Paulo/SP",
  "base_cut_price": "50.00",
  "acquisition_channel": "instagram",
  "onboarding_completed": true,
  "business_hours": {
    "monday": { "active": true, "start": "08:00", "end": "20:00" },
    "tuesday": { "active": true, "start": "08:00", "end": "20:00" },
    "wednesday": { "active": true, "start": "08:00", "end": "20:00" },
    "thursday": { "active": true, "start": "08:00", "end": "20:00" },
    "friday": { "active": true, "start": "08:00", "end": "20:00" },
    "saturday": { "active": true, "start": "08:00", "end": "20:00" },
    "sunday": { "active": false, "start": "08:00", "end": "20:00" }
  },
  "timezone": "America/Sao_Paulo",
  "created_at": "2026-08-29 14:28:35.09998+00"
}
```

### 4.2. Tabela `public.users`
```json
{
  "id": "d6fc99a3-c3f0-4299-ac38-8120829e1320",
  "tenant_id": "4ccdee97-2918-4815-8a2a-b52811dcd9c7",
  "email": "gestor.alpha@navalhado.com.br",
  "name": "Carlos Alpha Gestor",
  "role": "gerente",
  "is_active": true
}
```

### 4.3. Tabela `public.tenant_subscriptions`
```json
{
  "id": "8c172555-44a6-4458-8555-f61f069a9546",
  "tenant_id": "4ccdee97-2918-4815-8a2a-b52811dcd9c7",
  "plan_id": "b3fa7384-d113-4a1b-a5ed-1efeb7e51c22",
  "status": "active",
  "billing_cycle": "monthly"
}
```

### 4.4. Tabela `public.services`
| Nome | Preço | Duração | Categoria | Ativo |
| :--- | :--- | :--- | :--- | :---: |
| **Corte Tradicional** | R$ 50,00 | 30 min | `Cabelo` | Sim |
| **Barba** | R$ 38,00 | 30 min | `Barba` | Sim |
| **Corte e Barba** | R$ 80,00 | 45 min | `Combo` | Sim |
| **Hidratação e Selagem** | R$ 60,00 | 45 min | `Quimica` | Sim |

### 4.5. Tabela `public.professionals`
| Nome | Telefone | Comissão | user_id | Escala Padrão |
| :--- | :--- | :---: | :---: | :--- |
| **Carlos Alpha Gestor** | `11987654321` | 50.00% | `null` | Seg-Sáb 09:00-18:00 (Almoço 12:00-13:00) |
| **Diego Barbeiro** | `(11) 99887-7665` | 50.00% | `null` | Seg-Sáb 09:00-18:00 (Almoço 12:00-13:00) |

---

## ⚠️ 5. Relatório de Não-Conformidades e Itens Deferred

Abaixo está o levantamento detalhado de inconsistências visuais, funcionais e de persistência identificadas:

### 🔴 1. Badge de Categoria sempre exibindo "Outro" na Tabela de Serviços (UI)
* **Local:** `src/pages/gerente/onboarding/StepServices.tsx` (linha 178)
* **Problema:** A tabela de serviços exibe a tag `"Outro"` para todos os serviços cadastrados, inclusive os templates automáticos (Corte Tradicional, Barba, Corte e Barba) e serviços personalizados (Química).
* **Causa Raiz:** O código compara `s.category === 'cabelo'`, mas os templates definem `category: 'Cabelo'` (capitalizado). Além disso, não há tratamento para `'quimica'` ou `'estetica'`, caindo no ternário final `... : 'Outro'`.
* **Recomendação:** Normalizar a comparação usando `.toLowerCase()` ou um mapa de categorias abrangente.

---

### 🔴 2. Glitch de Formatação no Select de Duração de Serviços
* **Local:** `src/pages/gerente/onboarding/StepServices.tsx` (linha 261)
* **Problema:** O dropdown de duração exibe valores corrompidos como `"75 minutos (1.25h15m)"`, `"90 minutos (1.5h30m)"` e `"105 minutos (1.75h45m)"`.
* **Causa Raiz:** Foi utilizada divisão flutuante direta `${mins / 60}h` ao invés de extração inteira de horas com `Math.floor(mins / 60)`.
* **Recomendação:** Corrigir para `${Math.floor(mins / 60)}h${mins % 60 ? `${mins % 60}m` : ''}`.

---

### 🟡 3. Inconsistência na Máscara de Entrada de Valores Monetários (Step 2 vs Step 3)
* **Local:** `src/pages/gerente/onboarding/StepSegmentation.tsx` vs `StepServices.tsx` (linha 245)
* **Problema:** No Passo 2, o campo possui máscara de centavos (o usuário digita `5000` e vira `50,00`). No modal de serviço customizado do Passo 3, o input é de texto comum sem máscara (se o usuário digitar `6000` achando que há máscara, o sistema salva `R$ 6.000,00`).
* **Recomendação:** Padronizar todos os campos monetários com o mesmo componente de máscara monetária (`Intl` / centavos).

---

### 🟡 4. Descarte do Complemento de Endereço no Onboarding
* **Local:** `src/pages/gerente/OnboardingWizard.tsx` (linha 219) e esquema da tabela `public.tenants`
* **Problema:** O usuário preenche o campo "Complemento (Opcional)" (ex: `Andar 12, Sala 1204`), mas essa informação é descartada e não é salva no banco.
* **Causa Raiz:** A tabela `tenants` não possui a coluna `address_complement`, e a concatenação da string `address` no código ignora `location.complement`.
* **Recomendação:** Concatenar o complemento no campo `address` ou adicionar a coluna `address_complement` via migration no banco.

---

### 🟡 5. Campo `professionals.user_id` não associado para o Gestor Titular
* **Local:** `src/pages/gerente/OnboardingWizard.tsx` (linha 194)
* **Problema:** Ao incluir o gestor da barbearia como profissional titular na grade, o registro na tabela `professionals` fica com `user_id: null`.
* **Causa Raiz:** O payload de inserção de profissionais mapeia apenas `name`, `phone`, `commission_percentage`, sem checar se o profissional em questão é o gestor logado para vincular o `user_id`.
* **Recomendação:** Associar o `user_id` do gestor no profissional titular correspondente.

---

### 🔵 6. Tabela Associativa `professional_services` não populada
* **Local:** `src/pages/gerente/OnboardingWizard.tsx`
* **Problema:** Serviços e Profissionais são cadastrados, mas a tabela associativa `professional_services` permanece vazia (`[]`).
* **Impacto:** Se o agendamento no Canal do Cliente depender dessa tabela para saber quais barbeiros realizam quais procedimentos, novos clientes não conseguirão selecionar serviços por barbeiro até que o gestor faça essa amarração manual nas configurações.
* **Recomendação:** No Onboarding inicial, associar por padrão todos os serviços cadastrados a todos os barbeiros inseridos.

---

### 🔵 7. Divergência de Planos, Limites e Valores entre UI de Cadastro e Banco de Dados
* **Problema:** Divergência de valores e limites de profissionais:
  - **Cards do `/signup`:** Bronze R$ 49,90 (até 3 profs), Prata R$ 89,90 (até 8 profs), Ouro R$ 149,90 (profs ilimitados).
  - **Tabela `plans` no Banco:** Bronze R$ 99,00 (3 profs), Prata R$ 199,00 (6 profs), Ouro R$ 349,00 (15 profs).
  - **Onboarding UI:** Exibe "Limite de até 6 profissionais" para o plano Prata (conflitando com o card do cadastro que prometeu 8).
* **Recomendação:** Sincronizar as cópias de marketing do `/signup` com a tabela `plans` do banco de dados e a validação do wizard.

---

## 📂 6. Arquivos e Referências do Projeto

* Documento de Credenciais Atualizado: [`docs/credenciais_teste.md`](file:///c:/Projetos/navalhado/docs/credenciais_teste.md)
* Wizard de Onboarding: [`src/pages/gerente/OnboardingWizard.tsx`](file:///c:/Projetos/navalhado/src/pages/gerente/OnboardingWizard.tsx)
* Passo de Serviços: [`src/pages/gerente/onboarding/StepServices.tsx`](file:///c:/Projetos/navalhado/src/pages/gerente/onboarding/StepServices.tsx)
* Página de Cadastro: [`src/pages/CadastroBarbearia.tsx`](file:///c:/Projetos/navalhado/src/pages/CadastroBarbearia.tsx)
