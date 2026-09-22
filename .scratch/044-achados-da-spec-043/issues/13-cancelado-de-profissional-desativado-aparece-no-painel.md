# 13: Cancelamento de profissional desativado aparece no Painel de Cancelados

**What to build:** o Painel de Cancelados do Dia do gerente promete mostrar os cancelamentos de toda a barbearia. Não mostra: a tela só conhece os profissionais ativos, então o cancelamento de um profissional já desativado não aparece, nem com o filtro de equipe em "todos". O banco entrega a linha; a tela a descarta por não reconhecer o profissional.

Isso importa no caso mais comum de desativação: o profissional sai da barbearia, e justamente os horários dele do dia da saída ficam invisíveis para a recepção que precisaria remarcar. O contador também não os conta, então nada sinaliza que estão faltando.

Depois deste ticket, o painel mostra o que a barbearia cancelou no dia, inclusive o de quem já não está na equipe.

**Onde foi achado:** limite registrado no ticket 05 da spec 043.

**Blocked by:** 04 (Extrair a repetição entre a Agenda Geral e a Minha Agenda) — o 04 extrai o estado do painel que este ticket altera

**Status:** done

- [x] O Painel de Cancelados do Dia mostra o cancelamento de profissional desativado, com o nome dele
- [x] O contador de cancelamentos inclui esses casos
- [x] A grade de horários continua sem coluna de profissional desativado; o ticket não muda a grade
- [x] O filtro de equipe continua sendo recorte de leitura, nunca controle de acesso, e nenhuma verificação de papel é acrescentada na aplicação
- [x] Decidido em 2026-09-22: o cancelamento de profissional desativado aparece quando o filtro de equipe está com todos os profissionais, e some quando o gerente restringe o filtro a alguns; o profissional desativado não entra na lista do filtro
- [x] O contador segue a mesma regra do painel
- [x] O cartão sinaliza que o profissional está desativado, para a recepção não procurar por ele na equipe
- [x] O mesmo vale para a Minha Agenda do barbeiro apenas se o próprio barbeiro estiver desativado; caso contrário, nada muda lá
- [x] Teste de tela com um cancelamento de profissional desativado presente na leitura
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Causa confirmada:** `professionals` (o estado da tela) só carrega quem está ativo (`.eq('is_active', true)` na leitura de apoio). `selectedProfessionalIds` nasce desse array, e o cancelamento é filtrado por `selectedProfessionalIds.includes(cancelado.professional_id)` — um profissional desativado nunca entra em nenhum dos dois, então o cancelamento dele nunca passa no filtro, mesmo com "todos" marcados. O banco já entregava a linha (a política de leitura de `professionals` não exige `is_active`); só a tela descartava.
- **Nome do profissional passa a vir embutido na própria leitura**, não mais de um cruzamento com a lista de ativos: `AgendamentoDoDia` ganha `professional?: { id, name, is_active } | null`, preenchido pelo `select` de `carregarAgendamentosDoDia` (`professional:professionals (id, name, is_active)`) — o mesmo padrão que `customer` e `service` já usavam. Sem isso, o nome de um profissional desativado nunca apareceria, porque a lista de ativos nunca o contém.
- **`PainelCanceladosDoDia`** troca o cruzamento por id (`profissionais.find(...)`, que dependia da lista de ativos) pela leitura direta de `cancelado.professional`. A prop `profissionais`, que só servia para esse cruzamento, ficou sem uso e foi removida do componente e das duas chamadas (`Agenda.tsx`, `MinhaAgenda.tsx`). Quando `cancelado.professional.is_active` é `false`, um selo "Desativado" aparece ao lado do nome, com `title` explicando para a recepção não procurar a pessoa na equipe.
- **Regra do filtro (decisão de 2026-09-22), em `canceladosDoDia`:** com `selectedProfessionalIds.length === professionals.length` (todos os profissionais ativos marcados), o filtro deixa de restringir — mostra também quem já foi desativado. Basta o gerente desmarcar um profissional ativo qualquer para o cancelamento do desativado sumir de novo, porque aí o filtro passa a exigir member­ship exata, e o `professional_id` do desativado nunca está em `selectedProfessionalIds` (ele nunca entra nessa lista, construída só a partir de ativos). O contador (`canceladosDoDia.length`) usa a mesma leitura, então segue a regra automaticamente — nenhuma lógica duplicada.
- **Grade e controle de acesso intocados:** a grade de horários usa `visibleProfessionals`, memo totalmente separado de `canceladosDoDia`; não foi tocado. Nenhuma verificação de papel foi acrescentada — a mudança é só de que dado já lido é mostrado, com a mesma política de leitura de `professionals` que já existia (sem exigência de `is_active`).
- **Minha Agenda do barbeiro:** o próprio profissional (`professional`, singular) é carregado por `carregarCadastrosDoProfissional`, cuja consulta busca por `id` sem exigir `is_active` — já funcionava para o caso "o próprio barbeiro está desativado" antes deste ticket, só que dependendo indiretamente da lista `professionals=[professional]` conter a si mesmo. Agora depende do campo embutido, mais direto e correto pela mesma razão que corrige o lado do gerente. Nenhuma mudança de comportamento visível ali além de ganhar o selo "Desativado" quando aplicável, pelo mesmo componente compartilhado.
- **Vermelho provado por mutação:** os três testes novos rodados contra `Agenda.tsx` e `PainelCanceladosDoDia.tsx` de antes do ticket falham como esperado (o cancelamento do profissional desativado nunca aparece, com filtro completo ou não). Restaurado o código corrigido, os três passam.
- **Achado durante o ajuste dos testes existentes, sem relação com o bug:** as fixtures de teste (`cancelado()` em `Agenda.test.tsx`, `appointmentRow()` em `MinhaAgenda.test.tsx`) não embutiam `professional`, só `professional_id` — 12 testes que já existiam e verificavam o nome do profissional no painel começaram a mostrar o texto genérico "Profissional" depois da troca de fonte de dado. Corrigido embutindo `professional: mockProfessionals[...]` / `ME` nas fixtures, igual ao que `mockAppointments[0]` já fazia para a grade.
- Testes de tela novos em `src/pages/__tests__/Agenda.test.tsx` (describe "cancelamento de profissional desativado", dentro de "Painel de Cancelados do Dia"): mostra nome + selo "Desativado" com filtro completo; some do painel e do contador ao restringir o filtro; o profissional desativado não entra na lista de opções do filtro.
- Suíte completa da aplicação: 110 arquivos, 1206 testes (+3 deste ticket). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0. `npm run build`: build 0.
- Sem migration: mudança só de código de aplicação (a política de leitura de `professionals` já permitia o que a nova consulta embutida precisa). Contagens do banco no ambiente de desenvolvimento conferidas depois de toda a verificação: `tenants=3, appointments=35, customers=6, professionals=6, services=11, waiting_list=0, blocked_slots=0` — idênticas à linha de base do ticket 01.
