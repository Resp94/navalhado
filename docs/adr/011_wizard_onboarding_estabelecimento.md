# ADR 011: Wizard de Onboarding do Estabelecimento e Gatekeeper de Acesso

## Status

Aceita em 2026-08-15.

## Contexto

Após a conclusão do cadastro inicial em `CadastroBarbearia.tsx`, o sistema cria a autenticação do Gestor, a entidade do Tenant e a assinatura do plano. No entanto, a barbearia recém-criada iniciava em um estado desconfigurado — sem endereço físico geocodificado, sem catálogo inicial de serviços e sem profissionais cadastrados na tabela `public.professionals`. Isso gerava telas vazias no painel e impedia que o Canal do Cliente realizasse agendamentos.

Com base na engenharia reversa e no scraping estrutural do AppBarber ([docs/scraping_appbarber_wizard.md](file:///c:/Projetos/navalhado/docs/scraping_appbarber_wizard.md)), foi desenhado um assistente de 4 etapas para parametrizar o estabelecimento antes da operação regular.

## Decisão

1. **Gatekeeper de Onboarding:**
   - O acesso às rotas operacionais do tenant (`/dashboard`, `/agenda`, `/clientes`, etc.) é interceptado por um Gatekeeper no frontend e validado no backend.
   - Enquanto `public.tenants.onboarding_completed` for `false`, o Gestor é redirecionado compulsoriamente para a rota `/onboarding`.

2. **Passo 1 — Localização do Estabelecimento:**
   - Escopo estritamente nacional (Brasil como padrão fixo).
   - Autopreenchimento de logradouro, bairro, cidade e estado via **ViaCEP** a partir da digitação do CEP.
   - Geocodificação automática do endereço completo para persistência de `latitude` e `longitude` no `tenants`, permitindo mapas e rotas de GPS no Canal do Cliente.

3. **Passo 2 — Segmentação e Ticket Médio:**
   - Exibição de card informativo destacando o plano contratado (Bronze, Prata ou Ouro) e a capacidade máxima de profissionais permitida.
   - Coleta do preço base do corte (`base_cut_price`), que alimenta automaticamente a sugestão de valor no Passo 3.
   - Coleta do canal de aquisição (`acquisition_channel`) para métricas de marketing do SaaS.

4. **Passo 3 — Catálogo Inicial de Serviços:**
   - Templates rápidos em 1 clique (ex: *"Corte Tradicional"*, *"Barba"*, *"Corte + Barba"*, *"Acabamento"*), com o primeiro serviço já pré-preenchido com o valor informado no Passo 2.
   - Formulário flexível para cadastro manual com nome, preço, duração (múltiplos de 15 minutos) e categoria.
   - Trava de validação exigindo no mínimo 1 serviço ativo cadastrado.

5. **Passo 4 — Equipe de Profissionais e Cota do Plano:**
   - Sugestão de inclusão do próprio Gestor como primeiro profissional/barbeiro da agenda.
   - Formulário de adição rápida de novos barbeiros com Nome, Celular (WhatsApp) e percentual de comissão.
   - Trava visual e lógica baseada no limite `public.plans.max_professionals` do plano ativo.
   - Trava de segurança impedindo a exclusão caso exista apenas 1 profissional cadastrado.

6. **Finalização e Transição:**
   - Ao concluir o Passo 4, a aplicação persiste os dados pendentes e atualiza `public.tenants.onboarding_completed = true`.
   - O Gatekeeper detecta a conclusão e redireciona o Gestor para o `/dashboard`.

## Consequências

- O banco de dados (`public.tenants`) deve ser estendido com os campos de endereço (`cep`, `address_street`, `address_number`, `address_neighborhood`, `address_city`, `address_state`), coordenadas (`latitude`, `longitude`), `base_cut_price`, `acquisition_channel` e a flag `onboarding_completed`.
- O fluxo de autenticação e layout do Gerente passa a verificar o estado de `onboarding_completed`.
- A barbearia sempre inicia a operação comercial pronta para receber agendamentos reais pelo Canal do Cliente e WhatsApp.
