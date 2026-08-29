# Snapshot operacional — baseline funcional

**Data:** 28/08/2026  
**Commit de referência:** `6d5572d`  
**Working tree:** havia alterações locais pendentes nos arquivos de Serviços, seus testes e no relatório de responsividade no momento da captura. Este snapshot representa o estado validado do workspace, não necessariamente uma release publicada.

## Ambiente da validação

- Aplicação local em `http://localhost:5173`.
- Conta de teste da Barbearia Teste Navalhado.
- Viewports visuais utilizadas: **390×844** e **1280×900**.
- Banco e integrações remotas não foram modificados durante a validação deste snapshot.

## ✅ Funcional

### Serviços — `/servicos/cadastro`

- Em **390×844**, os cards aparecem em uma única coluna, sem overflow horizontal.
- O nome `Corte Degrade Premium` aparece completo após a compactação mobile.
- No mobile, posição e categoria são informações secundárias ocultas; preço, duração, retorno, status e ações continuam disponíveis.
- Em **1280×900**, posição e categoria continuam visíveis e o layout desktop permanece horizontal.
- Teste automatizado: `src/pages/gerente/__tests__/Servicos.test.tsx` — **4/4 aprovados**.

### Agenda — `/agenda`

- Agenda mobile e desktop carregam a grade do tenant respeitando o intervalo configurado.
- Sexta-feira configurada até 22:00 exibe slots até 21:30 para a grade de 30 minutos.
- Agendamentos normais respeitam expediente, escala, intervalo, antecedência e data.
- Encaixes são identificados visualmente, podem selecionar profissional ativo independentemente da escala dele e preservam as regras de conflito/capacidade existentes.
- Encaixes e agendamentos normais possuem diferenciação visual na agenda.
- O modal de não comparecimento é próprio da aplicação, sem alerta nativo do navegador.

### Comandas — `/comandas`

- Comandas vinculadas a encaixes exibem o badge `Encaixe`.
- Comandas vinculadas a agendamentos normais exibem o badge `Agendamento`.
- A origem é derivada da relação com o agendamento, não de heurística de cliente, horário ou itens.
- Identificação confirmada em mobile e desktop.

### Equipe — `/profissionais`

- Escala existente carrega sem perda de dados.
- Sexta-feira aparece até 22:00 e sábado até 15:00 no cenário validado.
- Domingo fechado aparece como folga.
- O seletor de horários da escala acompanha os limites do expediente configurado.

### Configurações — `/configuracoes`

- Fuso validado: Horário da Amazônia (UTC-4).
- Intervalo da grade validado: 30 minutos.
- Antecedência mínima para agendar e cancelar/reagendar validada: 60 minutos.
- Expediente validado: sexta até 22:00 e sábado até 15:00.

### Link público — `/barbearia-teste-navalhado`

- Fluxo de serviço → profissional → horário funciona em mobile e desktop.
- O profissional pode ser selecionado explicitamente ou pela opção `Tanto faz`.
- No cenário validado, os horários finais 20:30, 21:00 e 21:30 aparecem no mobile e desktop para fechamento às 22:00.
- O intervalo e os limites configurados são refletidos na grade pública.

## Regras críticas de preservação

- Não alterar a política de agendamento normal ao corrigir encaixes.
- Encaixe não deve ser restringido pelo horário individual do profissional; a seleção exige profissional ativo e não excluído, além das validações de conflito/capacidade.
- O intervalo da grade deve vir das configurações do tenant e atualizar Agenda, link público, bloqueios e escala da equipe.
- Conversões de horário devem respeitar o fuso configurado no tenant, nunca o fuso local do navegador.
- A origem de comanda deve continuar baseada em `comandas.appointment_id` e `appointments.is_fitting`.
- Alterações de banco exigem consulta pelo MCP do Supabase, migration versionada e validação de RLS, triggers e funções existentes.
- Não remover gatilhos de agenda, comanda, no-show, notificações ou políticas RLS existentes sem uma migração e regressão explícitas.
- Alterações responsivas devem manter o desktop funcional enquanto corrigem o mobile.

## ⚠️ Limitações e pendências conhecidas

- Este snapshot cobre validação visual e testes focados das áreas descritas; não representa aprovação de todos os fluxos do sistema.
- As larguras de 320px, 375px, tablets, landscape, zoom 200% e dispositivos reais ainda precisam de validação específica.
- O build apresentou apenas o aviso existente de bundle grande após minificação; não houve erro de compilação.

## Verificações executadas

- `npm test -- --run src/pages/gerente/__tests__/Servicos.test.tsx` — **4 testes aprovados**.
- `npm run build` — **aprovado**.
- `git diff --check` — sem erro de whitespace.
- Validação visual mobile em 390×844 — aprovada para Serviços, Agenda, Comandas, Equipe, Configurações, não comparecimento e link público.
- Validação visual desktop em 1280×900 — aprovada para Serviços, Agenda, Comandas, Equipe, Configurações e link público.
