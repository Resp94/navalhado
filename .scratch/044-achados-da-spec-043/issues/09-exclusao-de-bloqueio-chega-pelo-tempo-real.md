# 09: Exclusão de Bloqueio de Horário chega pelo tempo real

**What to build:** a Agenda acompanha mudanças de Bloqueio de Horário em tempo real, filtrando os eventos pela barbearia. Criar e alterar chegam. Excluir não chega: na exclusão, o evento carrega apenas a chave primária da linha, então o filtro por barbearia nunca casa e o evento é descartado antes de chegar à tela.

Quem exclui na própria tela não percebe, porque a tela recarrega por conta própria. Quem está com a Agenda aberta em outro aparelho continua vendo um Bloqueio que já não existe, até trocar de dia. Numa recepção com dois aparelhos, isso é um horário que parece indisponível e não está.

Depois deste ticket, a exclusão chega como a criação chega.

**Onde foi achado:** verificação do ticket 08 da spec 043. Conferido no banco: a tabela usa a identidade de réplica padrão e está publicada para o tempo real.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Excluir um Bloqueio de Horário faz a Agenda de outra sessão aberta tirá-lo da grade, sem troca de dia e sem recarregar a página
- [x] O evento de exclusão não vaza entre barbearias: uma sessão de outra barbearia não recarrega nem recebe dado da exclusão alheia
- [x] Criar e alterar Bloqueio continuam chegando como hoje
- [x] A Minha Agenda do barbeiro se comporta como a Agenda Geral nesse ponto
- [x] O evento de exclusão não dispara leitura de Agendamentos, e o de Agendamentos não dispara leitura de Bloqueios
- [x] A abordagem é do agente que pegar o ticket. Duas saídas plausíveis: ampliar o que a tabela publica na exclusão, ao custo de mais volume de registro no banco; ou tirar o filtro por barbearia dessa inscrição e recortar na tela, ao custo de acordar sessões de outras barbearias. Registre no ticket qual foi escolhida e por quê
- [x] Se a escolha ampliar o que a tabela publica, a mudança vai em migration e o efeito no volume é registrado
- [x] Verificado no navegador com duas sessões abertas na mesma barbearia
- [x] Vale conferir, e registrar, se a inscrição de Agendamentos tem o mesmo furo na exclusão
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Resultado (2026-09-22):**

- **Causa confirmada:** `Agenda.tsx` e `MinhaAgenda.tsx` assinam `postgres_changes` em `blocked_slots` com `filter: tenant_id=eq.<tenant>`. Criar e alterar chegam porque a linha nova completa sempre viaja no evento. Excluir não chegava porque `blocked_slots` estava com identidade de réplica padrão (`relreplident = 'd'`, só a chave primária): o evento de `DELETE` só carrega o `id` da linha apagada, sem `tenant_id`, e o filtro do lado do servidor nunca casava — o evento era descartado antes de sair do Postgres.
- **Abordagem escolhida: ampliar o que a tabela publica** (`ALTER TABLE public.blocked_slots REPLICA IDENTITY FULL`), não tirar o filtro e recortar na tela. A segunda opção acordaria toda sessão de toda barbearia a cada Bloqueio criado/alterado/excluído em qualquer barbearia — o volume cresce com o número de barbearias no sistema, não com o de bloqueios, e ainda transmite (mesmo que descartado no cliente) o id de linha de uma barbearia para a sessão de outra. `REPLICA IDENTITY FULL` custa WAL maior por `UPDATE`/`DELETE` (grava a linha antiga inteira, não só a chave), mas `blocked_slots` é pequena e de escrita rara e manual (bloqueio/liberação avulsa pelo gerente); o custo extra é desprezível perto de manter o isolamento por barbearia no servidor, como já é para inserção e alteração.
- **Isolamento entre barbearias:** com `REPLICA IDENTITY FULL`, a linha antiga completa (com `tenant_id`) passa a estar disponível no evento de exclusão, então o filtro `tenant_id=eq.<tenant>` do lado do servidor volta a casar — o evento nem chega a ser transmitido para sessões de outra barbearia. Não foi preciso mover o recorte para o cliente.
- **Migration** `supabase/migrations/20260922130000_044_ticket09_exclusao_de_bloqueio_chega_pelo_tempo_real.sql`, aplicada no ambiente de desenvolvimento. Sem mudança de código de aplicação: a correção é só no atributo da tabela; as inscrições de `Agenda.tsx` e `MinhaAgenda.tsx` já filtram e recarregam cada uma só a sua fonte (Agendamentos não recarrega Bloqueios, e vice-versa) — conferido lendo o código, comportamento já correto antes deste ticket.
- **Agendamento tem o mesmo furo em tese, não corrigido aqui:** `appointments` também está com identidade de réplica padrão e também permite `DELETE` por política (`appointments_delete_policy`, gerente/proprietário). Na prática nenhum caminho da aplicação apaga um Agendamento — ele só transiciona de status (cancelado, não compareceu), que é `UPDATE` e já chega normalmente, porque a linha nova completa sempre viaja no evento. `appointments` é bem mais escrita que `blocked_slots` (todo agendamento criado, reagendado ou com status mudado), então estender `REPLICA IDENTITY FULL` ali ampliaria o WAL por um caminho que a aplicação não usa. Registrado como o mesmo padrão, para revisitar se `DELETE` em Agendamento virar caminho real algum dia.
- pgTAP 57 (novo, 4 asserções): `blocked_slots` com `relreplident = 'f'`; `appointments` continua `'d'`; as duas continuam publicadas em `supabase_realtime`. pgTAP não observa a entrega de tempo real em si (roda em transação desfeita, sem commit, e a decodificação lógica só emite mudanças commitadas) — prova só o mecanismo estrutural. **4/4.**
- **Verificação no navegador com duas sessões — feita.** O responsável logou como barbeiro (Diego Barbeiro, Barbearia Alpha Dev); duas abas abertas em `/minha-agenda`, mesmo dia. Numa aba: criado Bloqueio 09:00–09:30 (Almoço) — apareceu na outra aba em tempo real (esse caminho já funcionava). Em seguida, excluído o mesmo Bloqueio na primeira aba — desapareceu na segunda aba sem F5 e sem trocar de dia, confirmando a correção. A Minha Agenda do barbeiro usa a mesma inscrição `postgres_changes` que a Agenda do gerente (`Agenda.tsx`), então o mecanismo verificado é o mesmo para as duas telas.
- Suíte completa da aplicação: 110 arquivos, 1198 testes (nenhum código de aplicação mudou). `npx tsc -b`: 0 erros. `npx oxlint`: exit 0. `npm run build`: build 0.
- Contagens do banco no ambiente de desenvolvimento, conferidas depois de toda a verificação: `tenants=3, appointments=35, customers=6, professionals=6, services=11, waiting_list=0, blocked_slots=0` — idênticas à linha de base do ticket 01.
- Migration só aplicada no ambiente de desenvolvimento; a aplicação em produção fica adiada por decisão do responsável (ver Out of Scope da spec 044), sem ticket próprio enquanto ele não decidir promover.
