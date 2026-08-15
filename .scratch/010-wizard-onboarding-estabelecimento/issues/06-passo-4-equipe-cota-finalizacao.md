# 06 — Passo 4 do Wizard: Equipe de Barbeiros, Cota do Plano e Finalização

**What to build:**
A quarta e última etapa do Wizard de Onboarding focada em configurar a equipe de atendimento da barbearia: sugere a inclusão automática do próprio Gestor como primeiro barbeiro com seu nome e WhatsApp de cadastro, permite a adição rápida de novos barbeiros (com comissão % e escala padrão), exibe um medidor visual de lotação da equipe de acordo com o plano contratado (`max_professionals`), impede exclusão caso reste apenas 1 profissional e executa a finalização atômica que persiste os dados, atualiza `onboarding_completed = true` no tenant e redireciona com Toast de sucesso para o `/dashboard`.

**Blocked by:** 05 — Passo 3 do Wizard: Catálogo Inicial de Serviços em 1 Clique

**Status:** ready-for-agent

- [ ] Componente `StepProfessionals` renderizado no quarto passo do Wizard.
- [ ] Prompt/Card sugerindo cadastrar o Gestor titular como o primeiro profissional da agenda com seu nome e telefone do cadastro inicial.
- [ ] Formulário de adição rápida de novos barbeiros com Nome, Celular (WhatsApp) com máscara e Percentual de Comissão (sugestão de 50%).
- [ ] Medidor visual de cota do plano no topo da lista (ex: `💈 1 de 3 profissionais cadastrados (Plano Bronze)`).
- [ ] Trava de limite impedindo a adição de mais profissionais quando a cota do plano for atingida, com aviso de upgrade.
- [ ] Trava de segurança desabilitando a remoção caso haja apenas 1 profissional cadastrado.
- [ ] Botão **"Finalizar Configuração"** que salva os serviços em `public.services`, os profissionais em `public.professionals`, grava os dados de localização e segmentação no `public.tenants` e define `onboarding_completed = true`.
- [ ] Transição suave para o `/dashboard` com emissão de Toast de boas-vindas.
