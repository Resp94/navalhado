# 13: Cancelamento de profissional desativado aparece no Painel de Cancelados

**What to build:** o Painel de Cancelados do Dia do gerente promete mostrar os cancelamentos de toda a barbearia. Não mostra: a tela só conhece os profissionais ativos, então o cancelamento de um profissional já desativado não aparece, nem com o filtro de equipe em "todos". O banco entrega a linha; a tela a descarta por não reconhecer o profissional.

Isso importa no caso mais comum de desativação: o profissional sai da barbearia, e justamente os horários dele do dia da saída ficam invisíveis para a recepção que precisaria remarcar. O contador também não os conta, então nada sinaliza que estão faltando.

Depois deste ticket, o painel mostra o que a barbearia cancelou no dia, inclusive o de quem já não está na equipe.

**Onde foi achado:** limite registrado no ticket 05 da spec 043.

**Blocked by:** 04 (Extrair a repetição entre a Agenda Geral e a Minha Agenda) — o 04 extrai o estado do painel que este ticket altera

**Status:** ready-for-agent

- [ ] O Painel de Cancelados do Dia mostra o cancelamento de profissional desativado, com o nome dele
- [ ] O contador de cancelamentos inclui esses casos
- [ ] A grade de horários continua sem coluna de profissional desativado; o ticket não muda a grade
- [ ] O filtro de equipe continua sendo recorte de leitura, nunca controle de acesso, e nenhuma verificação de papel é acrescentada na aplicação
- [ ] Decidido em 2026-09-22: o cancelamento de profissional desativado aparece quando o filtro de equipe está com todos os profissionais, e some quando o gerente restringe o filtro a alguns; o profissional desativado não entra na lista do filtro
- [ ] O contador segue a mesma regra do painel
- [ ] O cartão sinaliza que o profissional está desativado, para a recepção não procurar por ele na equipe
- [ ] O mesmo vale para a Minha Agenda do barbeiro apenas se o próprio barbeiro estiver desativado; caso contrário, nada muda lá
- [ ] Teste de tela com um cancelamento de profissional desativado presente na leitura
- [ ] `npm run lint`, `npm test` e `npm run build` passam
